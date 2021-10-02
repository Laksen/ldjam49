unit GameFont;

{$mode ObjFPC}

interface

uses
  Classes, SysUtils, Math,
  js, web, webgl,
  GameBase, GameMath;

type
  TSize = record
    Width,Height: double;
  end;

  TQuad = record
    P: array[0..4*3-1] of double;
    texCoords: array[0..2*4-1] of double;
  end;

  TQuads = array of TQuad;

  TTextRun = record
    X,Y,
    Width,Height: double;
    Texture: TGameTexture;
    Quads: TQuads;
    Text: string;
  end;

  TGameFont = class
  private class var
    fBuffersAllocated: boolean;
    fBuffer, fIndices: TJSWebGLBuffer;
    class procedure DoAllocate(gl: TJSWebGLRenderingContext);
  private
    fInfo: TJSObject;
    fPadding: TJSArray;
    fTexture: TGameTexture;

    fBase,
    fLineHeight: longint;

    function FindChar(c: char): TJSObject;
    function FindKerning(APrev, ACurrent: integer): integer;
  public
    constructor Create(const ASrcInfo: string; ASrcImage: TGameTexture);

    function MeasureText(const AStr: string): TSize;
    function Draw(const AStr: string): TTextRun;

    class procedure Render(GL: TJSWebGLRenderingContext; res: TTextRun; AViewport: TGameViewport; AColor: TGameColor);
  end;

var
  MSDFShader: TGameShader = nil;

implementation

const
  VertShader = 'attribute vec2 uv; attribute vec3 position; uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix; varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  FragShader = '#ifdef GL_OES_standard_derivatives'#13#10'#extension GL_OES_standard_derivatives : enable'#13#10'#endif'#13#10'precision highp float; uniform float opacity; uniform vec3 color; uniform sampler2D map; varying vec2 vUv; float median(float r, float g, float b) { return max(min(r, g), min(max(r, g), b)); } void main() { vec3 sample = texture2D(map, vUv).rgb; float sigDist = median(sample.r, sample.g, sample.b) - 0.5; float alpha = clamp(sigDist/fwidth(sigDist) + 0.5, 0.0, 1.0); gl_FragColor = vec4(color.xyz, alpha * opacity); if (gl_FragColor.a < 0.0001) discard; }';

class procedure TGameFont.DoAllocate(gl: TJSWebGLRenderingContext);
begin
  if not fBuffersAllocated then
  begin
    fBuffersAllocated:=true;
    fBuffer:=gl.createBuffer;
    fIndices:=gl.createBuffer;
  end;
end;

function TGameFont.FindChar(c: char): TJSObject;
var
  el: JSValue;
begin
  for el in TJSArray(fInfo['chars']) do
  begin
    if TJSObject(el)['char']=c then
      exit(TJSObject(el));
  end;

  result:=nil;
end;

function TGameFont.FindKerning(APrev, ACurrent: integer): integer;
var
  el: JSValue;
begin
  for el in TJSArray(fInfo['kernings']) do
  begin
    if (TJSObject(el)['first']=APrev) and (TJSObject(el)['second']=ACurrent) then
      exit(integer(TJSObject(el)['amount']));
  end;

  result:=0;
end;

constructor TGameFont.Create(const ASrcInfo: string; ASrcImage: TGameTexture);
begin
  inherited Create;
  fInfo:=TJSObject(TJSJSON.parse(ASrcInfo));
  fTexture:=ASrcImage;

  fPadding:=TJSArray(TJSObject(fInfo['info'])['padding']);

  fBase:=integer(TJSObject(fInfo['common'])['base']);
  fLineHeight:=integer(TJSObject(fInfo['common'])['lineHeight']);

  if MSDFShader=nil then
    MSDFShader:=TGameShader.Create(VertShader, FragShader);
end;

function TGameFont.MeasureText(const AStr: string): TSize;
var
  res: TJSObject;
  c: Char;
  prevID, x, xadv, width, delta: Integer;
begin
  result.Width:=0;
  result.Height:=fLineHeight;

  prevID:=-1;
  x:=0;
  for c in AStr do
  begin
    if c=#13 then continue;
    if c=#10 then
    begin                                     
      result.Width:=Max(result.Width, x+delta);
      result.Height:=result.Height+fLineHeight;
      x:=0;
      delta:=0;

      continue;
    end;

    res:=FindChar(c);
    if res=nil then
    begin
      exit;
    end;

    xadv:=integer(res['xadvance']);
    width:=integer(res['width']);
    delta:=width-xadv;

    x:=x+FindKerning(prevID, integer(res['id']))+xadv;
  end;

  result.Width:=Max(result.Width,x+delta);
end;

function TGameFont.Draw(const AStr: string): TTextRun;
var
  res: TJSObject;
  c: Char;
  prevID, x, xadv, width, idx, xoffset, yoffset, tx, ty, height, delta, y: Integer;
  TexScaling: double;

  function Quad(X,Y,W,H: double; TX,TY,TW,TH: double): TQuad;
  begin
    result.P[0*3+0]:=X;   result.P[0*3+1]:=Y;   result.P[0*3+2]:=0;
    result.P[1*3+0]:=X+W; result.P[1*3+1]:=Y;   result.P[1*3+2]:=0;
    result.P[2*3+0]:=X+W; result.P[2*3+1]:=Y+H; result.P[2*3+2]:=0;
    result.P[3*3+0]:=X;   result.P[3*3+1]:=Y+H; result.P[3*3+2]:=0;

    result.TexCoords[0*2+0]:=TX;    result.TexCoords[0*2+1]:=TY;
    result.TexCoords[1*2+0]:=TX+TW; result.TexCoords[1*2+1]:=TY;
    result.TexCoords[2*2+0]:=TX+TW; result.TexCoords[2*2+1]:=TY+TH;
    result.TexCoords[3*2+0]:=TX;    result.TexCoords[3*2+1]:=TY+TH;
  end;

begin            
  result.Width:=0;
  result.Height:=fLineHeight;
  result.Texture:=fTexture;
  result.Text:=AStr;
  setlength(result.Quads, length(astr));

  TexScaling:=1/fTexture.Width;

  prevID:=-1;
  x:=0;
  y:=0;
  idx:=0;
  for c in AStr do
  begin            
    if c=#13 then continue;
    if c=#10 then
    begin                                      
      result.Width:=Max(result.Width, x+delta);
      result.Height:=result.Height+fLineHeight;
      y:=y+fLineHeight;
      x:=0;
      delta:=0;

      continue;
    end;

    res:=FindChar(c);
    if res=nil then
      exit;

    xadv:=integer(res['xadvance']);

    xoffset:=integer(res['xoffset']);
    yoffset:=integer(res['yoffset']);

    tx:=integer(res['x']);
    ty:=integer(res['y']);
    width :=integer(res['width']);
    height:=integer(res['height']);

    result.Quads[idx]:=Quad(x+xoffset,y+yoffset,width,height, tx*TexScaling,ty*TexScaling, width*TexScaling,height*TexScaling);
                                                                      
    delta:=width-xadv;
    x:=x+FindKerning(prevID, integer(res['id']))+xadv;

    inc(idx);
  end;

  result.X:=-double(fPadding[3]);
  result.Y:=-double(fPadding[0]);
  result.Height:=result.Height+double(fPadding[0])+double(fPadding[2]);
  result.Width:=Max(result.Width, x+delta)+double(fPadding[1])+double(fPadding[3]);
end;

class procedure TGameFont.Render(GL: TJSWebGLRenderingContext; res: TTextRun; AViewport: TGameViewport; AColor: TGameColor);
var
  i, i2: Integer;
  vertices: TJSFloat32Array;
  indices: TJSUint16Array;
  shader: TGameShader;
  texLoc, pmLoc, mmLoc: TJSWebGLUniformLocation;
  vc: GLint;
begin
  DoAllocate(GL);

  vertices:=TJSFloat32Array.new(4*(3+2)*length(res.Quads));
  indices:=TJSUint16Array.new(2*3*length(res.Quads));

  for i:=0 to high(res.Quads) do
  begin
    for i2:=0 to 3 do
    begin
      vertices[i*4*(3+2)+i2*5+0]:=res.Quads[i].P[i2*3+0];
      vertices[i*4*(3+2)+i2*5+1]:=res.Quads[i].P[i2*3+1];
      vertices[i*4*(3+2)+i2*5+2]:=res.Quads[i].P[i2*3+2];

      vertices[i*4*(3+2)+i2*5+3]:=res.Quads[i].texCoords[i2*2+0];
      vertices[i*4*(3+2)+i2*5+4]:=res.Quads[i].texCoords[i2*2+1];
    end;

    indices._set([4*i+0,4*i+1,4*i+2, 4*i+2,4*i+3,4*i+0], 2*3*i);
  end;

  gl.bindBuffer(gl.ARRAY_BUFFER, fBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, nil);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fIndices);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, nil);

  gl.useProgram(MSDFShader.ID);

  gl.bindBuffer(gl.ARRAY_BUFFER, fBuffer);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, fIndices);

  texLoc:=gl.getUniformLocation(MSDFShader.ID, 'map');

  gl.uniform1f(gl.getUniformLocation(MSDFShader.ID, 'opacity'), 1.0);
  gl.uniform3f(gl.getUniformLocation(MSDFShader.ID, 'color'), AColor.R,AColor.G,AColor.B);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, res.Texture.ID);
  gl.uniform1i(texLoc, 0);

  pmLoc:=gl.getUniformLocation(MSDFShader.ID, 'projectionMatrix');
  mmLoc:=gl.getUniformLocation(MSDFShader.ID, 'modelViewMatrix');
  gl.uniformMatrix4fv(pmLoc, false, AViewport.Projection.Raw);
  gl.uniformMatrix4fv(mmLoc, false, AViewport.ModelView.Raw);

  vc:=gl.getAttribLocation(MSDFShader.ID, 'position');
  gl.vertexAttribPointer(vc,3,gl.FLOAT,false,20,0);
  gl.enableVertexAttribArray(vc);

  vc:=gl.getAttribLocation(MSDFShader.ID, 'uv');
  gl.vertexAttribPointer(vc,2,gl.FLOAT,false,20,12);
  gl.enableVertexAttribArray(vc);

  gl.drawElements(gl.TRIANGLES,2*3*length(res.Quads),gl.UNSIGNED_SHORT,0);
end;

end.

