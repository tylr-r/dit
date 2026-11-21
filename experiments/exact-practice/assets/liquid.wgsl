// Direct mathematical port of Dit MorseLiquidSurface's swirl, hue and timing.
struct Uniforms { time: f32, resolution: vec2f, devicePixelRatio: f32 }
@group(0) @binding(0) var<uniform> u: Uniforms;
@fragment fn liquid(@builtin(position) at: vec4f) -> @location(0) vec4f {
 var uv=(at.xy*2.0-u.resolution)/min(u.resolution.x,u.resolution.y);
 let t=u.time*0.35*(6.28318530718/10.0);
 uv+=vec2f(0.15*cos(t),0.15*sin(t));
 uv=vec2f(uv.x*cos(0.8)-uv.y*sin(0.8),uv.x*sin(0.8)+uv.y*cos(0.8));
 for(var i=1.0;i<4.5;i+=1.0){uv.x+=0.5/i*sin(i*1.6*uv.y+t);uv.y+=0.5/i*cos(i*1.7*uv.x+t+1.5);}
 var c=pow(vec3f(0.5*abs(sin(uv.x+t)),0.5*abs(sin(uv.y+t+2.0)),0.6*abs(sin(uv.x+uv.y))),vec3f(2.0));
 let shine=max(0.0,dot(normalize(max(c,vec3f(0.00001))),vec3f(0.577)));
 c=clamp(c,vec3f(0),vec3f(1))+vec3f(pow(shine,8.0)*0.15);
 let mx=max(c.r,max(c.g,c.b));c*=smoothstep(0.15,0.35,mx);
 let hi=max(c.r,max(c.g,c.b));let lo=min(c.r,min(c.g,c.b));let sat=(hi-lo)/(hi+0.00000001);
 let h=207.0/360.0;let rgb=clamp(abs(fract(vec3f(h)+vec3f(0,0.6666667,0.3333333))*6.0-3.0)-1.0,vec3f(0),vec3f(1));
 return vec4f(hi*mix(vec3f(1),rgb,sat)*0.55,1);
}
