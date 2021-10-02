program project1;

{$mode objfpc}

uses
  math,
  Web, webgl,
  JS, Classes, SysUtils, resources, utils,
  guibase, guictrls,
  gamebase, gameaudio, GameVerlets, GameMath, GameSprite,
  ECS, GameFont;

type
  TText = class(TGameElement)
  protected   
    r: Double;
    procedure Update(AGame: TGameBase; ATimeMS: double); override;
    procedure Render(gl: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
  end;

  TMyGame = class(TGameBase)
  public
    procedure InitializeResources; override;
    procedure AfterLoad; override;
  end;
                                      
var
  x: TGameTexture;
  s: TResourceString;

  fnt: TGameFont;              
var
  shader: TGameShader;

procedure TText.Update(AGame: TGameBase; ATimeMS: double);
begin
  inherited Update(AGame, ATimeMS);
  r:=ATimeMS;
end;

procedure TText.Render(gl: TJSWebGLRenderingContext; const AViewport: TGameViewport);
var
  res: TTextRun;
  v: TGameViewport;
begin
  res:=fnt.Draw('bTesting123 - login!¤#"¤(/)"'#10'lol'#10'F? ' + FloatToStr(r));

  writeln(res.x,',',res.y,',',res.width,',',res.height);

  v:=AViewport;
  v.Projection:=TPMatrix.Ortho(-game.width/2, game.width/2, game.Height/2, -game.Height/2, -10, 10);
  v.ModelView:=TPMatrix.Identity.Multiply(TPMatrix.CreateTranslation(-res.width/2,-res.Height/2,0).Transpose);

  TGameFont.Render(gl, res, v, TGameColor.New(1,0,0));
end;

procedure TMyGame.InitializeResources;
begin
  inherited InitializeResources;
  x:=TResources.AddImage('../stuff/custom.png');
  s:=TResources.AddString('../stuff/custom-msdf.json');
end;

procedure TMyGame.AfterLoad;
begin
  inherited AfterLoad;

  Writeln('Info: ', x.Width,'x',x.Height);
  writeln('Test? ', length(s.Text));

  fnt:=TGameFont.Create(s.Text, x);

  shader:=TGameShader.Create('attribute vec3 coordinates;'+
                             'attribute vec2 uv;'+
                             'uniform mat4 projectionMatrix;'+
                             'uniform mat4 modelViewMatrix;'+
                             'varying vec2 texCoord;'+
                             'void main(void){ texCoord = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(coordinates, 1.0); }',

                             'precision mediump float;'+
                             'varying vec2 texCoord;'+
                             'uniform sampler2D u_texSampler;'+
                             'void main(void) { gl_FragColor = texture2D(u_texSampler, texCoord).bgra; }'
                             );


  AddElement(ttext.Create);
end;

begin
  RunGame(TMyGame);
end.
