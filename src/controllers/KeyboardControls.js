import * as THREE from 'three';

/**
 * シンプルなキーボード＋マウスコントロール（FPS風）
 */
export class KeyboardControls {
  constructor(camera, domElement, config) {
    this.camera = camera;
    this.domElement = domElement;

    // 移動速度
    this.moveSpeed = 0.5;
    this.lookSpeed = 0.002;

    // カメラ回転角度（オイラー角）
    this.pitch = config.pitch; // 上下回転
    this.yaw = config.yaw;   // 左右回転

    // 床固定モード
    this.grounded = false;
    this.eyeHeight = 1.7; // 人間の視点の高さ（メートル）
    this.floorLevel = 0; // 床の高さ
    this.footHeight = 0.2; // 足元の余裕（階段などを登れるように）

    // 衝突検出
    this.collisionObjects = []; // 衝突判定対象のメッシュ
    this.raycaster = new THREE.Raycaster();
    this.collisionDistance = 2.0; // 衝突検出距離
    this.playerRadius = 1.0; // プレイヤーの半径

    // キー入力状態
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      up: false,
      down: false
    };

    // マウス状態
    this.isPointerLocked = false;

    // モード変更時のコールバック
    this.onModeChange = null;

    // イベントリスナーをバインド
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);

    this._attachEventListeners();
  }

  _attachEventListeners() {
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    this.domElement.addEventListener('click', this._onClick);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('mousemove', this._onMouseMove);
  }

  _onKeyDown(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
      case 'Space':
        this.keys.up = true;
        event.preventDefault();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.down = true;
        break;
      case 'KeyG':
        // モード切り替え
        this.grounded = !this.grounded;
        if (this.grounded) {
          // 床固定モードに切り替え時、視点の高さを設定
          this.camera.position.y = this.floorLevel + this.eyeHeight;
        }
        // コールバック実行
        if (this.onModeChange) {
          this.onModeChange(this.grounded);
        }
        break;
    }
  }

  _onKeyUp(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
      case 'Space':
        this.keys.up = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.down = false;
        break;
    }
  }

  _onClick() {
    // クリックでポインターロックのトグル
    if (this.isPointerLocked) {
      document.exitPointerLock();
    } else {
      this.domElement.requestPointerLock();
    }
  }

  _onPointerLockChange() {
    this.isPointerLocked = document.pointerLockElement === this.domElement;
  }

  _onMouseMove(event) {
    if (!this.isPointerLocked) return;

    // マウス移動で視点回転
    this.yaw -= event.movementX * this.lookSpeed;
    this.pitch -= event.movementY * this.lookSpeed;

    // ピッチ角を制限（真上・真下を見られるように）
    this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
  }

  setCollisionObjects(objects) {
    this.collisionObjects = objects;
  }

  _checkCollision(direction, distance = this.collisionDistance) {
    if (this.collisionObjects.length === 0) return null;

    const normalizedDir = direction.clone().normalize();
    this.raycaster.set(this.camera.position, normalizedDir);
    this.raycaster.far = distance;

    const intersects = this.raycaster.intersectObjects(this.collisionObjects, true);

    if (intersects.length > 0 && intersects[0].distance < distance) {
      return {
        hit: true,
        distance: intersects[0].distance,
        normal: intersects[0].face ? intersects[0].face.normal.clone() : new THREE.Vector3(0, 1, 0),
        point: intersects[0].point
      };
    }

    return null;
  }

  _slideAlongWall(velocity) {
    // 衝突チェック
    const collision = this._checkCollision(velocity, velocity.length() + this.collisionDistance);

    if (!collision) {
      return velocity;
    }

    // 衝突した場合、壁の法線に沿ってスライド
    const normal = collision.normal.clone();

    // ワールド空間の法線に変換（メッシュの回転を考慮）
    const worldNormal = normal.normalize();

    // 移動ベクトルを壁に平行な成分に分解
    const dot = velocity.dot(worldNormal);
    const slide = velocity.clone().sub(worldNormal.multiplyScalar(dot));

    // スライド後も衝突しないかチェック
    if (slide.length() > 0.01) {
      const slideCollision = this._checkCollision(slide, slide.length() + 0.5);
      if (slideCollision) {
        // スライド方向でも衝突する場合は移動を完全にキャンセル
        return new THREE.Vector3(0, 0, 0);
      }
    }

    return slide;
  }

  _checkGroundCollision() {
    if (this.collisionObjects.length === 0) return null;

    // 足元の位置（視点から下にeyeHeight分下げた位置）
    const footPosition = new THREE.Vector3(
      this.camera.position.x,
      this.camera.position.y - this.eyeHeight + this.footHeight,
      this.camera.position.z
    );

    // 下方向にレイキャスト
    const downDirection = new THREE.Vector3(0, -1, 0);
    this.raycaster.set(footPosition, downDirection);
    this.raycaster.far = this.footHeight + 2.0; // 余裕を持って検出

    const intersects = this.raycaster.intersectObjects(this.collisionObjects, true);

    if (intersects.length > 0) {
      return {
        distance: intersects[0].distance,
        groundY: intersects[0].point.y
      };
    }

    return null;
  }

  update() {
    // カメラの向きを更新
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    quaternion.setFromEuler(euler);
    this.camera.quaternion.copy(quaternion);

    // 移動方向ベクトル
    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    // カメラの前方・右方向を取得
    this.camera.getWorldDirection(direction);
    right.crossVectors(direction, up).normalize();

    const velocity = new THREE.Vector3();

    if (this.grounded) {
      // 床固定モード：水平方向のみ移動
      // 前方向を水平面に投影
      const horizontalDir = direction.clone();
      horizontalDir.y = 0;
      horizontalDir.normalize();

      // 前後移動
      if (this.keys.forward) {
        velocity.add(horizontalDir.clone().multiplyScalar(this.moveSpeed));
      }
      if (this.keys.backward) {
        velocity.add(horizontalDir.clone().multiplyScalar(-this.moveSpeed));
      }

      // 左右移動
      if (this.keys.left) {
        velocity.add(right.clone().multiplyScalar(-this.moveSpeed));
      }
      if (this.keys.right) {
        velocity.add(right.clone().multiplyScalar(this.moveSpeed));
      }

      // スライド挙動で衝突処理
      if (velocity.length() > 0) {
        const slidVelocity = this._slideAlongWall(velocity);
        this.camera.position.add(slidVelocity);
      }

      // 足元の床との当たり判定
      const groundCheck = this._checkGroundCollision();
      if (groundCheck) {
        // 床が検出された場合、その上に立つ
        const targetY = groundCheck.groundY + this.eyeHeight;
        this.camera.position.y = targetY;
      } else {
        // 床が検出されない場合、デフォルトの高さに戻す
        this.camera.position.y = this.floorLevel + this.eyeHeight;
      }

    } else {
      // 自由飛行モード：全方向移動可能
      // 前後移動
      if (this.keys.forward) {
        velocity.add(direction.clone().multiplyScalar(this.moveSpeed));
      }
      if (this.keys.backward) {
        velocity.add(direction.clone().multiplyScalar(-this.moveSpeed));
      }

      // 左右移動
      if (this.keys.left) {
        velocity.add(right.clone().multiplyScalar(-this.moveSpeed));
      }
      if (this.keys.right) {
        velocity.add(right.clone().multiplyScalar(this.moveSpeed));
      }

      // 上下移動
      if (this.keys.up) {
        velocity.add(up.clone().multiplyScalar(this.moveSpeed));
      }
      if (this.keys.down) {
        velocity.add(up.clone().multiplyScalar(-this.moveSpeed));
      }

      // 水平方向のスライド挙動
      const horizontalVelocity = new THREE.Vector3(velocity.x, 0, velocity.z);
      if (horizontalVelocity.length() > 0) {
        const slidVelocity = this._slideAlongWall(horizontalVelocity);
        velocity.x = slidVelocity.x;
        velocity.z = slidVelocity.z;
      }

      // Y方向の衝突チェック（上下）
      if (velocity.y !== 0) {
        const yDirection = new THREE.Vector3(0, velocity.y > 0 ? 1 : -1, 0);
        const yCollision = this._checkCollision(yDirection, Math.abs(velocity.y) + 1.0);

        if (yCollision) {
          velocity.y = 0;
        }
      }

      // カメラ位置を更新
      this.camera.position.add(velocity);

      // 足元の床との当たり判定（下降中または静止中）
      const groundCheck = this._checkGroundCollision();
      if (groundCheck && groundCheck.distance < this.footHeight) {
        // 床が足元に近すぎる場合、床の上に補正
        const targetY = groundCheck.groundY + this.eyeHeight;
        if (this.camera.position.y < targetY) {
          this.camera.position.y = targetY;
        }
      }

      // 最低高さの保証（床のメッシュがない場所用）
      const absoluteMinY = this.floorLevel + this.eyeHeight;
      if (this.camera.position.y < absoluteMinY) {
        this.camera.position.y = absoluteMinY;
      }
    }
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    this.domElement.removeEventListener('click', this._onClick);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);

    // ポインターロック解除
    if (this.isPointerLocked) {
      document.exitPointerLock();
    }
  }
}
