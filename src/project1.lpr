program project1;

{$mode objfpc}

uses
  math,
  Web, webgl,
  JS, Classes, SysUtils, resources, utils,
  guibase, guictrls,
  gamebase, gameaudio, GameVerlets, GameMath, GameSprite,
  ECS, GameFont, ldmap;

type
  TText = class(TGameElement)
  protected   
    r: Double;
    procedure Update(AGame: TGameBase; ATimeMS: double); override;
    procedure Render(gl: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
  end;

  TLD49Game = class(TGameBase)
  public
    procedure InitializeResources; override;
    procedure AfterLoad; override;

    procedure AfterResize; override;
  end;

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
  res:=GetFont('base').Draw('bTesting123 - login!¤#"¤(/)"'#10'lol'#10'F? ' + FloatToStr(r));

  v:=AViewport;
  v.Projection:=TPMatrix.Ortho(-game.width/2, game.width/2, game.Height/2, -game.Height/2, -10, 10);
  v.ModelView:=TPMatrix.Identity.Multiply(TPMatrix.CreateTranslation(-res.width/2,-res.Height/2,0));

  TGameFont.Render(gl, res, v, TGameColor.New(1,1,1));
end;

procedure TLD49Game.InitializeResources;
begin
  inherited InitializeResources;
  TResources.AddImage('assets/custom.png');
  TResources.AddString('assets/custom-msdf.json');

  TResources.AddImage('assets/grass.png');
  TResources.AddImage('assets/field.png');
  TResources.AddString('assets/tiles.json');

  TResources.AddImage('assets/barley.png');
  TResources.AddString('assets/barley.json');
end;

procedure TLD49Game.AfterLoad;
begin
  inherited AfterLoad;

  AddSprite(TResources.AddString('assets/barley.json').Text);
  LoadTiles(TResources.AddString('assets/tiles.json').Text);
  LoadFont('base', TResources.AddString('assets/custom-msdf.json').Text, TResources.AddImage('assets/custom.png'));

  AddElement(EntitySystem);
  AddElement(Map);

  //AddElement(ttext.Create);

  Map.SetCurrentSector(Map.GetSector(0,0));
  Map.CurrentSector.SetTile(1,1,'field');
  Map.CurrentSector.SetTile(2,2,'field');
end;

procedure TLD49Game.AfterResize;
begin
  inherited AfterResize;

  Viewport.Projection:=TPMatrix.Ortho(Width/4, -Width/4, Height/4, -Height/4, -10000, 10000);
  //Viewport.Projection:=TPMatrix.Perspective(40, width/height, 0.1, 10000);

  Viewport.ModelView:=TPMatrix.LookAt(TPVector.New(450/2-20,450/2,0),
                                      TPVector.New(300,-300,500),
                                      TPVector.New(0,0,-1));

end;

begin
  RunGame(TLD49Game);
end.
