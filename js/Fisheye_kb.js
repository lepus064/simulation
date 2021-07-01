const FisheyeShader = {

	uniforms: {
    "tDiffuse": 		{ type: "t", value: null },
    "h_fov": 		{ type: "f", value: 151.0 },
    "aspectRatio":		{ type: "f", value: 4.0/3.0 },
	},

	vertexShader: /* glsl */`
    varying vec2 vUV;                 // output to interpolate over screen
      
    void main() {
      gl_Position = projectionMatrix * (modelViewMatrix * vec4(position, 1.0));
      vUV = uv;
		}`,

	fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;      // sampler of rendered scenes render target
    uniform float h_fov;             // h: tan(verticalFOVInRadians / 2)
    uniform float aspectRatio;        // a: screenWidth / screenHeight
    varying vec2 vUV;               // interpolated vertex output data

    void main() {

      // to z = 1
      vec2 mv = vUV*2.0 - vec2(1.0, 1.0);
      mv.y /= aspectRatio;
      float r = sqrt(dot(mv, mv));
      if(r > 1.0){
        gl_FragColor = vec4(0, 0, 0, 0);
      }
      else{
        // need undistort
        float half_fov_arc = h_fov/360.0*3.1415927;
        float theta = r * half_fov_arc;
        float s = 1.0;
        float max_s = 1.0;
        if(theta > 0.0000001){
          s = tan(theta)/r;
          max_s = tan(half_fov_arc);
        }
        vec2 uv = (vUV-vec2(0.5, 0.5))*s/max_s + vec2(0.5, 0.5);

        gl_FragColor = texture2D(tDiffuse, uv);
        // gl_FragColor = texture2D(tDiffuse, vUV);
      }

		}`
};

export { FisheyeShader };