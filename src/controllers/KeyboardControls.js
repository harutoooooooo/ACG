import * as THREE from 'three';

/**
 * シンプルなキーボード＋マウスコントロール（FPS風）
 */
export class KeyboardControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // 移動速度
    this.moveSpeed = 0.5;
    this.lookSpeed = 0.002;

    // カメラ回転角度（オイラー角）
    this.pitch = 0; // 上下回転
    this.yaw = 0;   // 左右回転

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

    // マウス操作モード
    this.mouseOnlyMode = false; // trueの場合、マウスだけで操作（OrbitControls風）
    this.isLeftMouseDown = false;
    this.isRightMouseDown = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.mouseSensitivity = 0.002;

    // OrbitControls風の設定
    this.orbitTarget = new THREE.Vector3(0, 10, 0); // カメラが見る中心点
    this.orbitRadius = 100; // カメラと中心点の距離
    this.orbitTheta = 0; // 水平角度
    this.orbitPhi = Math.PI / 4; // 垂直角度

    // OrbitControlsのデフォルト値に合わせる
    this.rotateSpeed = 1.0;
    this.panSpeed = 1.0;
    this.zoomSpeed = 1.0;

    // Damping（滑らかな動き）- 元のコードはenableDamping = trueに設定していた
    this.enableDamping = true;
    this.dampingFactor = 0.05;
    this.sphericalDelta = { theta: 0, phi: 0 }; // OrbitControlsと同じ構造
    this.scale = 1.0;
    this.panOffset = new THREE.Vector3();

    // モード変更時のコールバック
    this.onModeChange = null;
    this.onControlModeChange = null; // 操作モード変更時のコールバック

    // イベントリスナーをバインド
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onClick = this._onClick.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);
    this._onWheel = this._onWheel.bind(this);

    this._attachEventListeners();
  }

  _attachEventListeners() {
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    this.domElement.addEventListener('click', this._onClick);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('contextmenu', this._onContextMenu);
    document.addEventListener('wheel', this._onWheel, { passive: false });
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
    // マウスだけモードではポインターロックを使わない
    if (this.mouseOnlyMode) return;

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

  _onMouseDown(event) {
    if (!this.mouseOnlyMode) return;

    if (event.button === 0) { // 左クリック = パン（このプロジェクトの設定）
      this.isRightMouseDown = true; // パンモード
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    } else if (event.button === 2) { // 右クリック = 回転（このプロジェクトの設定）
      this.isLeftMouseDown = true; // 回転モード
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      event.preventDefault();
    }
  }

  _onMouseUp(event) {
    if (event.button === 0) {
      this.isLeftMouseDown = false;
    } else if (event.button === 2) {
      this.isRightMouseDown = false;
    }
  }

  _onContextMenu(event) {
    if (this.mouseOnlyMode) {
      event.preventDefault(); // 右クリックメニューを無効化
    }
  }

  _onWheel(event) {
    if (!this.mouseOnlyMode) return;

    event.preventDefault();

    // OrbitControlsと同じズーム処理
    if (event.deltaY < 0) {
      this.dollyOut(this.getZoomScale());
    } else if (event.deltaY > 0) {
      this.dollyIn(this.getZoomScale());
    }
  }

  getZoomScale() {
    // OrbitControlsと同じ計算式
    return Math.pow(0.95, this.zoomSpeed);
  }

  dollyIn(dollyScale) {
    this.scale *= dollyScale;
  }

  dollyOut(dollyScale) {
    this.scale /= dollyScale;
  }

  rotateLeft(angle) {
    this.sphericalDelta.theta -= angle;
  }

  rotateUp(angle) {
    this.sphericalDelta.phi -= angle;
  }

  panLeft(distance, objectMatrix) {
    const v = new THREE.Vector3();
    v.setFromMatrixColumn(objectMatrix, 0); // x軸（右方向）

    // OrbitControlsと同じ計算: カメラの視野角と距離を考慮
    const element = this.domElement;
    const targetDistance = this.camera.position.distanceTo(this.orbitTarget);

    // PerspectiveCameraの場合
    if (this.camera.isPerspectiveCamera) {
      // 画面の高さに対応する実際の距離を計算
      const fov = this.camera.fov * Math.PI / 180;
      const panOffset = 2 * distance * Math.tan(fov / 2) * targetDistance / element.clientHeight;
      v.multiplyScalar(-panOffset * this.panSpeed);
    }

    this.panOffset.add(v);
  }

  panUp(distance, objectMatrix) {
    const v = new THREE.Vector3();
    v.setFromMatrixColumn(objectMatrix, 1); // y軸（上方向）

    // OrbitControlsと同じ計算: カメラの視野角と距離を考慮
    const element = this.domElement;
    const targetDistance = this.camera.position.distanceTo(this.orbitTarget);

    // PerspectiveCameraの場合
    if (this.camera.isPerspectiveCamera) {
      // 画面の高さに対応する実際の距離を計算
      const fov = this.camera.fov * Math.PI / 180;
      const panOffset = 2 * distance * Math.tan(fov / 2) * targetDistance / element.clientHeight;
      v.multiplyScalar(panOffset * this.panSpeed);
    }

    this.panOffset.add(v);
  }

  _onMouseMove(event) {
    // マウスだけモード（OrbitControls風）
    if (this.mouseOnlyMode) {
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;

      if (this.isLeftMouseDown) {
        // isLeftMouseDown = 回転（このプロジェクトの設定では右クリック→回転）
        // OrbitControlsと同じ計算式: 2 * PI * mouseDelta / clientHeight
        const element = this.domElement;
        this.rotateLeft(2 * Math.PI * deltaX / element.clientHeight * this.rotateSpeed);
        this.rotateUp(2 * Math.PI * deltaY / element.clientHeight * this.rotateSpeed);
      } else if (this.isRightMouseDown) {
        // isRightMouseDown = パン（このプロジェクトの設定では左クリック→パン）
        this.panLeft(deltaX, this.camera.matrix);
        this.panUp(deltaY, this.camera.matrix);
      }

      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      return;
    }

    // ポインターロックモードの処理
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
    // マウスだけモード（OrbitControls風）
    if (this.mouseOnlyMode) {
      // OrbitControlsと同じ更新処理

      // パンオフセットを適用
      this.orbitTarget.add(this.panOffset);

      // スケールを半径に適用
      this.orbitRadius *= this.scale;

      // 距離制限
      this.orbitRadius = Math.max(10, Math.min(500, this.orbitRadius));

      // Dampingを適用
      if (this.enableDamping) {
        this.orbitTheta += this.sphericalDelta.theta * this.dampingFactor;
        this.orbitPhi += this.sphericalDelta.phi * this.dampingFactor;
      } else {
        this.orbitTheta += this.sphericalDelta.theta;
        this.orbitPhi += this.sphericalDelta.phi;
      }

      // 垂直角度を制限（0からπまで）
      this.orbitPhi = Math.max(0, Math.min(Math.PI, this.orbitPhi));

      // 球面座標からカメラ位置を計算
      const x = this.orbitRadius * Math.sin(this.orbitPhi) * Math.sin(this.orbitTheta);
      const y = this.orbitRadius * Math.cos(this.orbitPhi);
      const z = this.orbitRadius * Math.sin(this.orbitPhi) * Math.cos(this.orbitTheta);

      this.camera.position.set(
        this.orbitTarget.x + x,
        this.orbitTarget.y + y,
        this.orbitTarget.z + z
      );

      // カメラを中心点に向ける
      this.camera.lookAt(this.orbitTarget);

      // Delta値をリセット
      if (this.enableDamping) {
        this.sphericalDelta.theta *= (1 - this.dampingFactor);
        this.sphericalDelta.phi *= (1 - this.dampingFactor);
        this.panOffset.multiplyScalar(1 - this.dampingFactor);
      } else {
        this.sphericalDelta.theta = 0;
        this.sphericalDelta.phi = 0;
        this.panOffset.set(0, 0, 0);
      }

      this.scale = 1;

      return;
    }

    // キーボード操作モード
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

      // 前後移動（キーボード）
      if (this.keys.forward) {
        velocity.add(horizontalDir.clone().multiplyScalar(this.moveSpeed));
      }
      if (this.keys.backward) {
        velocity.add(horizontalDir.clone().multiplyScalar(-this.moveSpeed));
      }

      // 左右移動（キーボード）
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
      // 前後移動（キーボード）
      if (this.keys.forward) {
        velocity.add(direction.clone().multiplyScalar(this.moveSpeed));
      }
      if (this.keys.backward) {
        velocity.add(direction.clone().multiplyScalar(-this.moveSpeed));
      }

      // 左右移動（キーボード）
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
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('contextmenu', this._onContextMenu);
    document.removeEventListener('wheel', this._onWheel);
    this.domElement.removeEventListener('click', this._onClick);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);

    // ポインターロック解除
    if (this.isPointerLocked) {
      document.exitPointerLock();
    }
  }

  // 操作モードを切り替え
  setMouseOnlyMode(enabled) {
    this.mouseOnlyMode = enabled;

    if (enabled) {
      // ポインターロックを解除
      if (this.isPointerLocked) {
        document.exitPointerLock();
      }

      // 現在のカメラ位置からOrbitControlsの初期設定を計算
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);

      // カメラの前方にターゲットを設定
      this.orbitTarget.copy(this.camera.position).add(direction.multiplyScalar(50));

      // 現在のカメラ位置から球面座標を計算
      const offset = new THREE.Vector3().subVectors(this.camera.position, this.orbitTarget);
      this.orbitRadius = offset.length();
      this.orbitTheta = Math.atan2(offset.x, offset.z);
      this.orbitPhi = Math.acos(Math.max(-1, Math.min(1, offset.y / this.orbitRadius)));

      // Delta値とオフセットをリセット
      this.sphericalDelta = { theta: 0, phi: 0 };
      this.scale = 1.0;
      this.panOffset.set(0, 0, 0);
    }

    // コールバック実行
    if (this.onControlModeChange) {
      this.onControlModeChange(enabled);
    }
  }
}
