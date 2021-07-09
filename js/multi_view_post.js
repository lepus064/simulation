// import * as THREE from 'https://cdn.skypack.dev/three@0.129.0';
// import { EffectComposer } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/EffectComposer.js';
// import { RenderPass } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/RenderPass.js';
// import { ShaderPass } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/postprocessing/ShaderPass.js';
// import { FlyControls } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/FlyControls.js';
// import { OrbitControls } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/controls/OrbitControls.js';
// import { GUI } from 'https://cdn.skypack.dev/three@0.129.0/examples/jsm/libs/dat.gui.module.js';

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'three/examples/jsm/libs/dat.gui.module.js';

import { Detector } from './Detector.js'
import { FisheyeShader } from './Fisheye_kb.js'
import * as util from './util.js'

const fs = require('fs');
const path = require('path');
const { ipcRenderer } = require('electron')

let renderer;
let controls;

const clock = new THREE.Clock();

// load json
let rawdata = fs.readFileSync(path.resolve(__dirname, 'data/camera.json'));
let camera_data = JSON.parse(rawdata);
rawdata = fs.readFileSync(path.resolve(__dirname, 'data/params.json'));
let params = JSON.parse(rawdata);
params['side_cams']['ratio'] = params['side_cams']['ratio_w'] / params['side_cams']['ratio_h'];


params['saveExtrinsic'] = function () {
  console.log("save");
  const outfile = {"cv":{}, "gl":{}}
  let T_cam0_track;
  for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {
    const m = new THREE.Matrix4();
    util.cv2gl(m);
    m.makeRotationFromQuaternion(params['side_cams']['rot2track'][ii]);
    m.setPosition(params['side_cams']['trans2track'][ii].clone().multiplyScalar(1000.0));
    outfile["gl"]["T_track_cam" + ii] = m.clone().transpose().elements;
    if (ii === 0) {
      T_cam0_track = m.clone().invert();
      outfile["cv"]["T_cam0_cam" + ii] = (new THREE.Matrix4()).elements;
    }
    else {
      outfile["cv"]["T_cam0_cam" + ii] = util.cv2gl(m.clone().premultiply(T_cam0_track)).transpose().elements;
    }
  }
  ipcRenderer.invoke('save file', outfile);

}

// create tracking ref
const tracking_ref = new THREE.Object3D();
tracking_ref.matrixWorld.identity();

let windowWidth, windowHeight, CAM_W, CAM_H, EYE_W, EYE_H;

function getVerticalFov(h_fov, ratio) {
  return Math.atan(Math.tan(h_fov / 360.0 * Math.PI) / ratio) * 360.0 / Math.PI;
}

document.addEventListener('DOMContentLoaded', function () {
  if (!Detector.webgl) Detector.addGetWebGLMessage();
  util.loadParams(camera_data, params);
  init();
  animate();
});

function init() {
  // get info
  const displayInfo = document.getElementById('info');

  // get container
  const container = document.getElementById('mainDrawing');
  const AMOUNT = params['side_cams']['nums'];

  windowWidth = container.offsetWidth;
  windowHeight = window.innerHeight;

  CAM_W = (container.offsetWidth / AMOUNT);
  CAM_H = CAM_W / params['side_cams']['ratio'];
  const CAM_RATIO = params['side_cams']['ratio'];

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
    const v_fov = getVerticalFov(params['side_cams']['h_fov'], CAM_RATIO);
    const camera = new THREE.PerspectiveCamera(v_fov, CAM_RATIO, 0.05, 10);
    camera.quaternion.copy(params['side_cams']['rot2track'][ii]);
    camera.position.copy(params['side_cams']['trans2track'][ii]);
    tracking_ref.attach(camera);
    params['side_cams']['cams'].push(camera);
  }
  params['global_cam'] = new THREE.PerspectiveCamera(90, EYE_RATIO * 2, 0.001, 20);
  params['global_cam'].position.set(0, 0, -0.2);
  params['global_cam'].lookAt(0, 0, 0);
  tracking_ref.attach(params['global_cam']);


  const showInfoChanger = function () {
    if (params["showInfo"]) {
      displayInfo.style.display = "block";
    }
    else {
      displayInfo.style.display = "none";
    }
  }

  const eyeChanger = function () {
    for (let ii = 0; ii < params['eyes']['cams'].length; ++ii) {
      const camera = params['eyes']['cams'][ii];
      camera.position.x = params['eyes']['IPD(m)'] * (ii - 0.5);
      camera.fov = params['eyes']['fov'];
    }
  };

  const sceneSizeChanger = function () {
    if (params.scenes['current'] == 'room') {
      params.scenes['env'][params.scenes['current']].children[0].scale.x = params.scenes['room_size']['width'];
      params.scenes['env'][params.scenes['current']].children[0].scale.y = params.scenes['room_size']['height'];
      params.scenes['env'][params.scenes['current']].children[0].scale.z = params.scenes['room_size']['depth'];
    }
    if (params.scenes['current'] == 'sphere') {
      params.scenes['env'][params.scenes['current']].children[0].scale.x = params.scenes['sphere_radius'];
      params.scenes['env'][params.scenes['current']].children[0].scale.y = params.scenes['sphere_radius'];
      params.scenes['env'][params.scenes['current']].children[0].scale.z = params.scenes['sphere_radius'];
    }
  };

  const sceneEnvChanger = function () {
    for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {
      params['side_cams']['composers'][ii].passes[0] = new RenderPass(params.scenes['env'][params.scenes['current']], params['side_cams']['cams'][ii]);
    }
    if (params.scenes['current'] == 'room') {
      scene_size_param.show();
      sphere_param.hide();
    }
    else if (params.scenes['current'] == 'sphere') {
      sphere_param.show();
      scene_size_param.hide();
      if (params["current_main_view"] === "global") {
        params['global_cam'].position.set(0, 0, 0.5);
      }
    }
    else {
      sphere_param.hide();
      scene_size_param.hide();
    }
    tracking_ref.position.set(0, 0, 0);
    tracking_ref.quaternion.identity();
    sceneSizeChanger();
  }

  const mainViewChanger = function () {
    controls.dispose();
    if (params["current_main_view"] === "eye") {
      // fly control
      controls = new FlyControls(tracking_ref, renderer.domElement);

      controls.movementSpeed = 1.0;
      controls.domElement = container;
      controls.rollSpeed = Math.PI / 3;
      controls.autoForward = false;
      controls.dragToLook = true;
      params["showInfo"] = true;
    }
    else {
      controls = new OrbitControls(params['global_cam'], renderer.domElement);
      // controls.listenToKeyEvents( window );
      controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
      controls.dampingFactor = 0.05;

      controls.screenSpacePanning = false;

      controls.minDistance = 0.1;
      controls.maxDistance = 5;

      controls.maxPolarAngle = Math.PI;
      params["showInfo"] = false;
      if (params.scenes['current'] == 'sphere') {
        params['global_cam'].position.set(0, 0, 0.5);
      }
    }
    sceneEnvChanger();
    showInfoChanger();
  }

  const sideCamChanger = function () {
    if (params['side_cams']["symmetry01"]) {
      cam_params[1].hide();
    }
    else {
      cam_params[1].show();
    }
    if (params['side_cams']["symmetry23"]) {
      cam_params[3].hide();
    }
    else {
      cam_params[3].show();
    }
    for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {
      const camera = params['side_cams']['cams'][ii];
      const v_fov = getVerticalFov(params['side_cams']['h_fov'], CAM_RATIO);
      camera.fov = v_fov;
      params['side_cams']['composers'][ii].passes[1].uniforms['h_fov'].value = params['side_cams']['h_fov'];
      params['side_cams']['rot2track'][ii].normalize();
      // extrinsic
      if (ii === 0 && params['side_cams']["symmetry01"]) {
        params['side_cams']['trans2track'][1].copy(params['side_cams']['trans2track'][0])
        params['side_cams']['trans2track'][1].x *= -1;
        params['side_cams']['rot2track'][1].w = -params['side_cams']['rot2track'][0].z;
        params['side_cams']['rot2track'][1].z = -params['side_cams']['rot2track'][0].w;
        params['side_cams']['rot2track'][1].x = params['side_cams']['rot2track'][0].y;
        params['side_cams']['rot2track'][1].y = params['side_cams']['rot2track'][0].x;
      }
      if (ii === 2 && params['side_cams']["symmetry23"]) {
        params['side_cams']['trans2track'][3].copy(params['side_cams']['trans2track'][2])
        params['side_cams']['trans2track'][3].x *= -1;
        params['side_cams']['rot2track'][3].w = params['side_cams']['rot2track'][2].z;
        params['side_cams']['rot2track'][3].z = params['side_cams']['rot2track'][2].w;
        params['side_cams']['rot2track'][3].x = -params['side_cams']['rot2track'][2].y;
        params['side_cams']['rot2track'][3].y = -params['side_cams']['rot2track'][2].x;
      }
      camera.position.copy(params['side_cams']['trans2track'][ii]);
      camera.quaternion.copy(params['side_cams']['rot2track'][ii]);
    }
  }

  params.scenes['env']['room'] = util.createColorRoom();

  const scene = new THREE.Scene();

  // load camera ply
  util.loadAndAttach('./data/out50cm.ply', params, tracking_ref, params.scenes['env']['room']);

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
  // params.scenes['env']['room2'] = scene;
  params.scenes['env']['real'] = util.createRealScene();
  params.scenes['env']['sphere'] = util.createSphere();
  util.loadSpotLight(params.scenes['env']['sphere'], tracking_ref, params, './data/outline50.ply');
  sceneSizeChanger();

  // add renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.offsetWidth, window.innerHeight);
  renderer.autoClear = false;

  for (let ii = 0; ii < params['side_cams']['nums']; ++ii) {
    let composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(params.scenes['env'][params.scenes['current']], params['side_cams']['cams'][ii]));
    let effect1 = new ShaderPass(FisheyeShader);
    effect1.uniforms['h_fov'].value = params['side_cams']['h_fov'];
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
  gui.width = 350;
  console.log(gui.width);
  const scene_param = gui.addFolder('Scenes');
  scene_param.add(params, "showInfo").name("show info").onChange(showInfoChanger).listen();
  scene_param.add(params, "current_main_view", Object.keys(params["main_view"])).onChange(mainViewChanger);;
  scene_param.add(params.scenes, 'current', Object.keys(params.scenes['env'])).onChange(sceneEnvChanger);;
  const scene_size_param = scene_param.addFolder('room size');
  scene_size_param.add(params.scenes['room_size'], 'width', 1.5, 7.0, 0.1).name("width(m)").onChange(sceneSizeChanger);
  scene_size_param.add(params.scenes['room_size'], 'height', 1.5, 7.0, 0.1).name("height(m)").onChange(sceneSizeChanger);
  scene_size_param.add(params.scenes['room_size'], 'depth', 1.5, 7.0, 0.1).name("depth(m)").onChange(sceneSizeChanger);
  scene_param.open();
  const sphere_param = scene_param.addFolder('sphere radius');
  sphere_param.add(params.scenes, 'sphere_radius', 0.1, 2.0, 0.05).name("sphere_radius(m)").onChange(sceneSizeChanger);
  sphere_param.open();
  sphere_param.hide();
  const eye_param = scene_param.addFolder('Eyes');
  eye_param.add(params.eyes, 'IPD(m)', 0.05, 0.075, 0.001).onChange(eyeChanger).listen();
  eye_param.add(params.eyes, 'fov', 80.0, 100.0, 0.5).name("V fov(deg)").onChange(eyeChanger);
  eye_param.open();
  const side_param = gui.addFolder('Cameras');
  const side_general_param = side_param.addFolder("general");
  side_general_param.add(params.side_cams, 'h_fov', 120.0, 170.0, 0.5).name("H fov(deg)").onChange(sideCamChanger);
  side_general_param.add(params.side_cams, "symmetry01").name("symmetry cam0 cam1").onChange(sideCamChanger);
  side_general_param.add(params.side_cams, "symmetry23").name("symmetry cam2 cam3").onChange(sideCamChanger);
  side_general_param.add(params, "saveExtrinsic").name("save extrinsic to json");
  side_general_param.open();
  const cam_params = []
  for (let cam = 0; cam < 4; cam++) {
    const cam_param = side_param.addFolder("cam" + cam);
    cam_param.add(params.side_cams['trans2track'][cam], "x", -0.1, 0.1, 0.0001).name("x").onChange(sideCamChanger).listen();
    cam_param.add(params.side_cams['trans2track'][cam], "y", -0.07, 0.07, 0.0001).name("y").onChange(sideCamChanger).listen();
    cam_param.add(params.side_cams['trans2track'][cam], "z", -0.06, -0.01, 0.0001).name("z").onChange(sideCamChanger).listen();
    cam_param.add(params.side_cams['rot2track'][cam], "w", -1, 1, 0.001).name("quaternion w").onChange(sideCamChanger).listen();
    cam_param.add(params.side_cams['rot2track'][cam], "x", -1, 1, 0.001).name("quaternion x").onChange(sideCamChanger).listen();
    cam_param.add(params.side_cams['rot2track'][cam], "y", -1, 1, 0.001).name("quaternion y").onChange(sideCamChanger).listen();
    cam_param.add(params.side_cams['rot2track'][cam], "z", -1, 1, 0.001).name("quaternion z").onChange(sideCamChanger).listen();
    cam_param.open();
    cam_params.push(cam_param);
  }
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

  // make sure everything updated
  sideCamChanger();
  mainViewChanger();
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
  // controls.update();
  controls.update(delta);
  // updateSize();
  // updateTrackingRef();
  tracking_ref.updateMatrixWorld();

  if (params.scenes['current'] === 'sphere') {
    for (let ii = 0; ii < params['side_cams']['spotlightUpdate'].length; ++ii) {
      params['side_cams']['spotlightUpdate'][ii]();
    }
  }

  if (params["current_main_view"] === "eye") {
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
    }
  }
  else {
    const camera = params['global_cam'];
    const left = Math.floor(0);
    const bottom = Math.floor(CAM_H);
    const width = Math.floor(2.0 * EYE_W);
    let height = Math.floor(EYE_H);

    renderer.setViewport(left, bottom, width, height);
    renderer.setScissor(left, bottom, width, height);
    renderer.setScissorTest(true);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(params.scenes['env'][params.scenes['current']], camera);
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
