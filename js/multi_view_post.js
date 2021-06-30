import * as THREE from 'https://cdn.skypack.dev/three@0.129.0';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/ShaderPass.js';
import { FlyControls } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/FlyControls.js';
import { GUI } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/libs/dat.gui.module.js';
import { FisheyeShader } from './Fisheye_kb.js'

let renderer;
let controls;
const clock = new THREE.Clock();

const fs = require('fs');
const path = require('path');

let rawdata = fs.readFileSync(path.resolve(__dirname, 'data/camera.json'));
let camera_data = JSON.parse(rawdata);
// const m = new THREE.Matrix4();
// m.fromArray(camera_data["cam0"]);
// let r;
// for(let i = 0 ; i < 4;++i){
//   console.log(camera_data['cam'+i]);
// }


const tracking_ref = new THREE.Object3D();
tracking_ref.matrixWorld.identity();

let mouseX = 0, mouseY = 0;

let windowWidth, windowHeight, CAM_W, CAM_H, EYE_W, EYE_H;

let h_fov = 150.0;
const v_fov = Math.atan(Math.tan(h_fov / 360.0 * 3.1415927) * 3.0 / 4.0) * 360.0 / 3.1415927

const params = {
  scenes: {
    room_size:{
      'width' : 3, 'height' : 3, 'depth' : 3
    },
    current: 'room',
    env:{}
  },
  eyes: {
    nums: 2,
    'IPD(m)': 0.06,
    'fov': 90.0,
    cams: []
  },
  side_cams: {
    nums: 4,
    cams: [],
    rot2track: [],
    trans2track: [],
    composers: []
  }
};

document.addEventListener('DOMContentLoaded', function () {
  if (!Detector.webgl) Detector.addGetWebGLMessage();
  loadParams();
  init();
  animate();
});

function loadParams(){
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

function init() {

  // get container
  const container = document.getElementById('mainDrawing');
  const AMOUNT = params['side_cams']['nums'];

  windowWidth = container.offsetWidth;
  windowHeight = window.innerHeight;

  CAM_W = (container.offsetWidth / AMOUNT);
  CAM_H = CAM_W * 3.0 / 4.0;
  const CAM_RATIO = CAM_W / CAM_H;

  EYE_W = (container.offsetWidth / 2);
  EYE_H = window.innerHeight - CAM_H;
  const EYE_RATIO = EYE_W / EYE_H;

  // add eye
  for (let ii = 0; ii < params['eyes']['nums']; ++ii) {
    const eye_fov = params['eyes']['fov'];
    const camera = new THREE.PerspectiveCamera(eye_fov, EYE_RATIO, 0.05, 10);
    tracking_ref.attach(camera);
    params['eyes']['cams'].push(camera);
  }

  // add cams
  for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {
    const camera = new THREE.PerspectiveCamera(v_fov, CAM_RATIO, 0.05, 10);
    camera.quaternion.copy(params['side_cams']['rot2track'][ii]);
    camera.position.copy(params['side_cams']['trans2track'][ii]);
    tracking_ref.attach(camera);
    params['side_cams']['cams'].push(camera);
  }

  const eyeChanger = function () {
    for (let ii = 0; ii < params['eyes']['cams'].length; ++ii) {
      const camera = params['eyes']['cams'][ii];
      camera.position.x = params['eyes']['IPD(m)'] * (ii - 0.5);
      camera.fov = params['eyes']['fov'];
    }
  };

  const sceneSizeChanger = function () {
    params.scenes['env'][params.scenes['current']].children[0].scale.x = params.scenes['room_size']['width'];
    params.scenes['env'][params.scenes['current']].children[0].scale.y = params.scenes['room_size']['height'];
    params.scenes['env'][params.scenes['current']].children[0].scale.z = params.scenes['room_size']['depth'];
  };

  const sceneEnvChanger = function(){
    for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {
      params['side_cams']['composers'][ii].passes[0] = new RenderPass(params.scenes['env'][params.scenes['current']], params['side_cams']['cams'][ii]);
    }
    tracking_ref.position.set(0, 0, 0);
    tracking_ref.quaternion.identity();
  }


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

  const light = new THREE.DirectionalLight(0xffffff);
  light.position.set(0, 0, 1);
  scene.add(light);
  params.scenes['env']['room'] = scene.clone();

  const radius = 0.2;
  const geometry1 = new THREE.IcosahedronGeometry(radius, 1);
  const count = geometry1.attributes.position.count;
  geometry1.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const color = new THREE.Color();
  const positions1 = geometry1.attributes.position;
  const colors1 = geometry1.attributes.color;

  for (let i = 0; i < count; i++) {
    color.setHSL((positions1.getY(i) / radius + 1) / 2, 1.0, 0.5);
    colors1.setXYZ(i, color.r, color.g, color.b);
  }

  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    flatShading: true,
    vertexColors: true,
    shininess: 0
  });

  const wireframeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true });

  let mesh = new THREE.Mesh(geometry1, material);
  let wireframe = new THREE.Mesh(geometry1, wireframeMaterial);
  mesh.add(wireframe);
  scene.add(mesh);
  // mesh.position.x = - 0.5;
  // mesh.rotation.x = - 1.87;
  const light2 = new THREE.DirectionalLight(0xffffff);
  light2.position.set(0, 1, 1);
  scene.add(light2);
  params.scenes['env']['room2'] = scene;
  sceneSizeChanger();

  // add renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.offsetWidth, window.innerHeight);
  renderer.autoClear = false;

  for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {
    let composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(params.scenes['env'][params.scenes['current']], params['side_cams']['cams'][ii]));
    let effect1 = new ShaderPass(FisheyeShader);
    composer.addPass(effect1);
    params['side_cams']['composers'].push(composer);
    // var glitchPass = new GlitchPass();
    // composer.addPass( glitchPass );
    // if(ii === 0){
    //   const helper = new THREE.CameraHelper( params['side_cams']['cams'][ii] );
    //   scene.add( helper );
    // }
  }
  // current_scene = scene;

  // GUI
  const gui = new GUI();
  const scene_param = gui.addFolder('Scenes');
  scene_param.add( params.scenes, 'current', Object.keys( params.scenes['env'] ) ).onChange( sceneEnvChanger );;
  const scene_size_param = scene_param.addFolder('size');
  scene_size_param.add( params.scenes['room_size'], 'width', 1.5, 7.0, 0.1 ).onChange( sceneSizeChanger );
  scene_size_param.add( params.scenes['room_size'], 'height', 1.5, 7.0, 0.1 ).onChange( sceneSizeChanger );
  scene_size_param.add( params.scenes['room_size'], 'depth', 1.5, 7.0, 0.1 ).onChange( sceneSizeChanger );
  scene_param.open();
  const eye_param = gui.addFolder('Eyes');
  eye_param.add(params.eyes, 'IPD(m)', 0.05, 0.075, 0.001).onChange(eyeChanger).listen();
  eye_param.add(params.eyes, 'fov', 80.0, 100.0, 0.5).onChange(eyeChanger);
  eye_param.open();
  const side_param = gui.addFolder('Cameras');
  side_param.add(params.eyes, 'IPD(m)', 0.05, 0.075, 0.001).onChange(eyeChanger).listen();
  side_param.add(params.eyes, 'fov', 80.0, 100.0, 0.5).onChange(eyeChanger);
  side_param.open();

  // add renderer to container
  container.appendChild(renderer.domElement);


  // fly control
  controls = new FlyControls(tracking_ref, renderer.domElement);

  controls.movementSpeed = 1.0;
  controls.domElement = container;
  controls.rollSpeed = Math.PI / 3;
  controls.autoForward = false;
  controls.dragToLook = true;

  // events

  window.addEventListener('resize', onWindowResize);

  // document.addEventListener('mousemove', onDocumentMouseMove);

}

function onWindowResize() {

  const container = document.getElementById('mainDrawing');
  const AMOUNT = params['side_cams']['nums'];
  renderer.setSize(container.offsetWidth, window.innerHeight);

  windowWidth = container.offsetWidth;
  windowHeight = window.innerHeight;

  CAM_W = (container.offsetWidth / AMOUNT);
  CAM_H = CAM_W * 3.0 / 4.0;

  EYE_W = (container.offsetWidth / 2);
  EYE_H = window.innerHeight - CAM_H;
}


// function updateTrackingRef() {
//   tracking_ref.position.x += mouseX * 0.00005;
//   tracking_ref.position.x = Math.max(Math.min(tracking_ref.position.x, 2), - 2);
// }

function animate() {

  render();

  requestAnimationFrame(animate);

}

function render() {

  const delta = clock.getDelta();

  controls.update(delta);
  // updateSize();
  // updateTrackingRef();
  tracking_ref.updateMatrixWorld();
  for (let ii = 0; ii < params['eyes']['cams'].length; ++ii) {

    const camera = params['eyes']['cams'][ii];

    const left = Math.floor(EYE_W * ii);
    const bottom = Math.floor(CAM_H);
    const width = Math.floor(EYE_W);
    let height = Math.floor(EYE_H);

    renderer.setViewport(left, bottom, width, height);
    renderer.setScissor(left, bottom, width, height);
    renderer.setScissorTest(true);
    // renderer.setClearColor(view.background);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.render(params.scenes['env'][params.scenes['current']], camera);
    // renderer.render(scene, camera);

  }

  for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {

    const camera = params['side_cams']['cams'][ii];

    const left = Math.floor(CAM_W * ii);
    const bottom = Math.floor(0);
    const width = Math.floor(CAM_W);
    let height = Math.floor(CAM_H);

    renderer.setViewport(left, bottom, width, height);
    renderer.setScissor(left, bottom, width, height);
    renderer.setScissorTest(true);
    // renderer.setClearColor(view.background);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // renderer.render(scene, camera);
    params['side_cams']['composers'][ii].render();
  }

}
