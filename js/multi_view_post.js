import * as THREE from 'https://cdn.skypack.dev/three@0.129.0';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/ShaderPass.js';
import { FlyControls } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/FlyControls.js';
import { GUI } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/libs/dat.gui.module.js';
import { FisheyeShader } from './Fisheye_kb.js'

let scene, renderer;
let controls;
const clock = new THREE.Clock();
let cam_composers = [];

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
  eyes:{
    nums: 2,
    'IPD(m)': 0.06,
    'fov': 90.0,
    cams: []
  },
  side_cams:{
    nums: 4,
    cams:[],
    composers:[]
  }
};

// const cams = [
//   {
//     background: new THREE.Color(0.7, 0.5, 0.5),
//     eye: [0, 0.9, 0],
//     up: [0, 0, 1]
//   },
//   {
//     background: new THREE.Color(0.7, 0.5, 0.5),
//     eye: [0, 0.0, 0],
//     up: [0, 0, 1]
//   },
//   {
//     background: new THREE.Color(0.5, 0.5, 0.5),
//     eye: [0.1, 0.9, 0],
//     up: [0, 0, 1]
//   },
//   {
//     background: new THREE.Color(0.6, 0.5, 0.5),
//     eye: [0, 0.9, 0.1],
//     up: [0, 0, 1]
//   }
// ];

document.addEventListener('DOMContentLoaded', function () {
  if (!Detector.webgl) Detector.addGetWebGLMessage();
  init();
  animate();
});

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
    const m = new THREE.Matrix4();
    m.fromArray(camera_data["cam"+ii]);
    m.transpose();
    m.elements[12] /= 1000.0;
    m.elements[13] /= 1000.0;
    m.elements[14] /= 1000.0;
    camera.applyMatrix4(m);
    tracking_ref.attach(camera);
    params['side_cams']['cams'].push(camera);
  }

  const matChanger = function ( ) {
    for (let ii = 0; ii < params['eyes']['cams'].length; ++ii) {
      const camera = params['eyes']['cams'][ii];
      camera.position.x = params['eyes']['IPD(m)']*(ii-0.5);
      camera.fov = params['eyes']['fov'];
    }
  };

  // GUI
  const gui = new GUI();
  const eye_param = gui.addFolder( 'eyes' );
  eye_param.add( params.eyes, 'IPD(m)', 0.05, 0.075, 0.001 ).onChange( matChanger );
  eye_param.add( params.eyes, 'fov', 80.0, 100.0, 0.5 ).onChange( matChanger );
  eye_param.open();

  scene = new THREE.Scene();

  // setup room
  let geometrycc = new THREE.BoxGeometry(3, 3, 3);
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

  // add renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.offsetWidth, window.innerHeight);
  renderer.autoClear = false;

  for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {
    let composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, params['side_cams']['cams'][ii]));
    let effect1 = new ShaderPass(FisheyeShader);
    composer.addPass(effect1);
    params['side_cams']['composers'].push(composer);
      // var glitchPass = new GlitchPass();
      // composer.addPass( glitchPass );
  }

  // add renderer to container
  container.appendChild(renderer.domElement);


  // fly control
  controls = new FlyControls(tracking_ref, renderer.domElement);

  controls.movementSpeed = 0.5;
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

  controls.update( delta );
  // updateSize();
  // updateTrackingRef();
  tracking_ref.updateMatrixWorld();
  for (let ii = 0; ii < params['eyes']['cams'].length; ++ii) {
  
    const camera = params['eyes']['cams'][ii];

    const left = Math.floor(EYE_W *ii);
    const bottom = Math.floor(CAM_H);
    const width = Math.floor(EYE_W);
    let height = Math.floor(EYE_H);

    renderer.setViewport(left, bottom, width, height);
    renderer.setScissor(left, bottom, width, height);
    renderer.setScissorTest(true);
    // renderer.setClearColor(view.background);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);

  }

  for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {

    const camera = params['side_cams']['cams'][ii];

    const left = Math.floor(CAM_W *ii);
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
