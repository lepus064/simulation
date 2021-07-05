import * as THREE from 'https://cdn.skypack.dev/three@0.129.0';
import { PLYLoader } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/PLYLoader.js';

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
  const light = new THREE.AmbientLight( 0x404040 ); // soft white light
  scene.add( light);
  return scene;
}

function createSphere(){

  const scene = new THREE.Scene();
  const geometry = new THREE.SphereGeometry( 0.3, 32, 32 );
  const material = new THREE.MeshStandardMaterial( {color: 0xffff00, side: THREE.BackSide} );
  const sphere = new THREE.Mesh( geometry, material );
  sphere.receiveShadow = true; //default
  sphere.castShadow = true; //default is false
  scene.add( sphere );
  
  const sphereGeometry = new THREE.SphereGeometry( 0.1, 32, 32 );
  const sphereMaterial = new THREE.MeshStandardMaterial( { color: 0xff0000 } );
  const sphere2 = new THREE.Mesh( sphereGeometry, sphereMaterial );
  sphere2.castShadow = true; //default is false
  sphere2.receiveShadow = true; //default
  sphere2.position.z = -0.3;
  // scene.add(sphere2);

  const light = new THREE.AmbientLight( 0x404040 ); // soft white light
  scene.add( light);
  const wireframe = new THREE.WireframeGeometry( geometry );

  const line = new THREE.LineSegments( wireframe );
  line.material.depthTest = false;
  line.material.opacity = 0.25;
  line.material.transparent = true;
  // scene.add(line);

  const target = new THREE.Object3D();
  target.position.z = -1;
  scene.add(target);

  const spotLight = new THREE.SpotLight( 'red' );
  spotLight.position.set( 0, 0, 0 );
  spotLight.decay = 0;
  
  spotLight.castShadow = true;
  spotLight.angle = 151.0/360.0* Math.PI;
  
  spotLight.shadow.mapSize.width = 1024;
  spotLight.shadow.mapSize.height = 1024;
  
  spotLight.shadow.camera.near = 0.0005;
  spotLight.shadow.camera.far = 2;
  spotLight.shadow.camera.fov = 151;
  spotLight.shadow.camera.lookAt(target.position);
  spotLight.shadow.focus = 1;
  spotLight.distance = 1;

  spotLight.target = target;
  
  scene.add( spotLight );

  const loader = new PLYLoader();
  loader.load('./data/outline50.ply', function (geometry) {

    geometry.computeVertexNormals();
    const vx180 = new THREE.Vector3(1, 0, 0);
    const qx180 = new THREE.Quaternion();
    qx180.setFromAxisAngle(vx180, 3.1415927);
    geometry.applyQuaternion(qx180);

    const m_colors = ['red', 'blue', 'yellow', 'green']
    const material = new THREE.MeshStandardMaterial({ color: m_colors[0], flatShading: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.multiplyScalar(0.00001);
    // mesh.position.z = -0.01;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // m.parent = params['side_cams']['cams'][ii];
    // .attach(m);
    scene.add(mesh);

  });

  const lightHelper = new THREE.SpotLightHelper( spotLight );
  scene.add( lightHelper );
  const shadowCameraHelper = new THREE.CameraHelper( spotLight.shadow.camera );
  scene.add( shadowCameraHelper );

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
  createRealScene,
  createSphere
}