// import * as THREE from 'https://cdn.skypack.dev/three@0.129.0';
// import { PLYLoader } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/loaders/PLYLoader.js';
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

function loadParams(camera_data, params) {
  if(params['side_cams']['rot2track'].length === 0){
    for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {
      const quaternion = new THREE.Quaternion();
      params['side_cams']['rot2track'].push(quaternion);
    }
  }
  if(params['side_cams']['trans2track'].length === 0){
    for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {
      const translation = new THREE.Vector3();
      params['side_cams']['trans2track'].push(translation);
    }
  }
  for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {
    const T_track_cam = new THREE.Matrix4();
    T_track_cam.fromArray(camera_data["gl"]["T_track_cam" + ii]);
    T_track_cam.transpose();
    T_track_cam.elements[12] /= 1000.0;
    T_track_cam.elements[13] /= 1000.0;
    T_track_cam.elements[14] /= 1000.0;

    const quaternion = new THREE.Quaternion();
    const translation = new THREE.Vector3();
    translation.setFromMatrixPosition(T_track_cam);
    quaternion.setFromRotationMatrix(T_track_cam);
    params['side_cams']['rot2track'][ii].copy(quaternion);
    params['side_cams']['trans2track'][ii].copy(translation);
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
  const light = new THREE.AmbientLight(0x404040); // soft white light
  scene.add(light);
  return scene;
}

function createSphere() {

  const scene = new THREE.Scene();
  const geometry = new THREE.SphereGeometry(1.0, 32, 32);
  const color = new THREE.Color("white");
  const material = new THREE.MeshStandardMaterial({ color: color, side: THREE.BackSide });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.receiveShadow = true; //default
  sphere.castShadow = true; //default is false
  scene.add(sphere);

  // scene.add(sphere2);

  const light = new THREE.AmbientLight(0x404040); // soft white light
  light.intensity = 0.5;
  scene.add(light);
  const wireframe = new THREE.WireframeGeometry(geometry);

  const line = new THREE.LineSegments(wireframe);
  line.material.depthTest = false;
  line.material.opacity = 0.25;
  line.material.transparent = true;
  // scene.add(line);


  // const lightHelper = new THREE.SpotLightHelper( spotLight );
  // scene.add( lightHelper );
  // const shadowCameraHelper = new THREE.CameraHelper( spotLight.shadow.camera );
  // scene.add( shadowCameraHelper );

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

function loadAndAttach(ply_name, params, tracking_ref, scene) {
  const loader = new PLYLoader();
  loader.load(ply_name, function (geometry) {

    geometry.computeVertexNormals();
    const vx180 = new THREE.Vector3(1, 0, 0);
    const qx180 = new THREE.Quaternion();
    qx180.setFromAxisAngle(vx180, Math.PI);
    geometry.applyQuaternion(qx180);

    const m_colors = ['red', 'blue', 'yellow', 'green']
    for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {
      const material = new THREE.MeshStandardMaterial({ color: m_colors[ii], flatShading: true, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.multiplyScalar(0.001 * 0.01);

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.onBeforeRender = function () {

        this.quaternion.copy(params['side_cams']['cams'][ii].quaternion);
        this.position.copy(params['side_cams']['cams'][ii].position);
        const m = new THREE.Matrix4();
        m.makeRotationFromQuaternion(tracking_ref.quaternion);
        m.setPosition(tracking_ref.position);
        this.applyMatrix4(m);

      };
      scene.add(mesh);
    }

  });
}

function loadSpotLight(scene, tracking_ref, params, mask_path) {

  const loader = new PLYLoader();
  loader.load(mask_path, function (geometry) {

    geometry.computeVertexNormals();
    const vx180 = new THREE.Vector3(1, 0, 0);
    const qx180 = new THREE.Quaternion();
    qx180.setFromAxisAngle(vx180, Math.PI);
    geometry.applyQuaternion(qx180);

    params['side_cams']['spotlightUpdate'] = [];
    // params['side_cams']['spotlights'] = [];
    // params['side_cams']['spotlightsTar'] = [];
    // params['side_cams']['spotlightsMesh'] = [];
    const m_colors = ['red', 'blue', 'yellow', 'green']
    for (let ii = 0; ii < 4; ++ii) {
      const color = new THREE.Color( m_colors[ii] );
      const spotLight = new THREE.SpotLight(color);
      // spotLight.position.set(0, 0, 0);
      spotLight.decay = 0;

      spotLight.castShadow = true;
      spotLight.angle = 151.0 / 360.0 * Math.PI;
      spotLight.intensity = 0.25;

      spotLight.shadow.mapSize.width = 512;
      spotLight.shadow.mapSize.height = 512;

      spotLight.shadow.camera.near = 0.0005;
      spotLight.shadow.camera.far = 2;
      spotLight.shadow.camera.fov = 151;
      spotLight.shadow.focus = 1;
      spotLight.distance = 1;

      scene.add(spotLight);

      const target = new THREE.Object3D();
      spotLight.shadow.camera.lookAt(target.position);
      spotLight.target = target;
      scene.add(target);


      const material = new THREE.MeshStandardMaterial({ color: color, flatShading: true, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.multiplyScalar(0.00001);
      mesh.castShadow = true;
      
      scene.add(mesh);
      // spotLight.position.set(0, 0.1, 0);
      const updateFunc = function(){
        spotLight.quaternion.copy(params['side_cams']['cams'][ii].quaternion);
        spotLight.position.copy(params['side_cams']['cams'][ii].position);
        const m = new THREE.Matrix4();
        m.makeRotationFromQuaternion(tracking_ref.quaternion);
        m.setPosition(tracking_ref.position);
        spotLight.applyMatrix4(m);

        mesh.quaternion.copy(spotLight.quaternion);
        mesh.position.copy(spotLight.position);

        target.quaternion.identity();
        target.position.set(0, 0, -1);
        const m1 = new THREE.Matrix4();
        m1.makeRotationFromQuaternion(spotLight.quaternion);
        m1.setPosition(spotLight.position);
        target.applyMatrix4(m1);

      }
      params['side_cams']['spotlightUpdate'].push(updateFunc);
      // break;
    }
    // const material = new THREE.MeshStandardMaterial({ color: m_colors[0], flatShading: true, side: THREE.DoubleSide });
    // const mesh = new THREE.Mesh(geometry, material);
    // mesh.scale.multiplyScalar(0.00001);

    // mesh.castShadow = true;
    // m.parent = params['side_cams']['cams'][ii];
    // .attach(m);

  });
}

function cv2gl(m){
  const m_cv2gl = new THREE.Matrix4();
  m_cv2gl.set( 1,  0,  0,  0,
               0, -1,  0,  0,
               0,  0, -1,  0,
               0,  0,  0,  1 );
  
  return m.clone().premultiply(m_cv2gl).multiply(m_cv2gl);
}

export {
  loadParams,
  createColorRoom,
  createRealScene,
  createSphere,
  loadAndAttach,
  loadSpotLight,
  cv2gl
}