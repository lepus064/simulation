import * as THREE from 'https://cdn.skypack.dev/three@0.129.0';

function loadParams(camera_data, params) {
  for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {
    const T_track_cam = new THREE.Matrix4();
    T_track_cam.fromArray(camera_data["cam" + ii]);
    T_track_cam.transpose();
    T_track_cam.elements[12] /= 1000.0;
    T_track_cam.elements[13] /= 1000.0;
    T_track_cam.elements[14] /= 1000.0;

    const quaternion = new THREE.Quaternion();
    const translation = new THREE.Vector3();
    translation.setFromMatrixPosition(T_track_cam);
    quaternion.setFromRotationMatrix(T_track_cam);
    params['side_cams']['rot2track'].push(quaternion);
    params['side_cams']['trans2track'].push(translation);
  }
}

function createColorRoom() {
  const scene = new THREE.Scene();

  // setup room
  let geometrycc = new THREE.BoxGeometry(1, 1, 1);
  const roomColors = ['green', 'red', 'magenta', 'yellow', 'teal', 'blue'];
  var colorcc = [];
  for (let i = 0; i < roomColors.length; i++) {
    const color5 = new THREE.Color(roomColors[i % 6]);
    for (let j = 0; j < 4; j++) {
      colorcc.push(color5.r, color5.g, color5.b);
    }
  }
  geometrycc.setAttribute('color', new THREE.Float32BufferAttribute(colorcc, 3));
  var materialcc = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: THREE.FaceColors,
    side: THREE.BackSide
  });
  const cubecc = new THREE.Mesh(geometrycc, materialcc);
  scene.add(cubecc);
  return scene;
}

function createRealScene() {

  const scene = new THREE.Scene();

  let hemiLight = new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 1.0);
  scene.add(hemiLight);

  let floorMat = new THREE.MeshStandardMaterial({
    roughness: 0.8,
    color: 0xffffff,
    metalness: 0.2,
    bumpScale: 0.0005
  });

  const textureLoader = new THREE.TextureLoader();

  const fl_aniso = 2;
  const floorx = 7;
  const floory = 7;

  textureLoader.load("./data/textures/hardwood2_diffuse.jpg", function (map) {

    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = fl_aniso;
    map.repeat.set(floorx, floory);
    map.encoding = THREE.sRGBEncoding;
    floorMat.map = map;
    floorMat.needsUpdate = true;

  });
  textureLoader.load("./data/textures/hardwood2_bump.jpg", function (map) {

    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = fl_aniso;
    map.repeat.set(floorx, floory);
    floorMat.bumpMap = map;
    floorMat.needsUpdate = true;

  });
  textureLoader.load("./data/textures/hardwood2_roughness.jpg", function (map) {

    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = fl_aniso;
    map.repeat.set(floorx, floory);
    floorMat.roughnessMap = map;
    floorMat.needsUpdate = true;

  });

  const floorGeometry = new THREE.PlaneGeometry(7, 7);
  const floorMesh = new THREE.Mesh(floorGeometry, floorMat);
  floorMesh.receiveShadow = true;
  floorMesh.rotation.x = - Math.PI / 2.0;
  floorMesh.position.y = -1.5;
  scene.add(floorMesh);

  return scene;
}

export {
  loadParams,
  createColorRoom,
  createRealScene
}