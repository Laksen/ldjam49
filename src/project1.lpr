program project1;

{$mode objfpc}

uses
  math,
  Web, webgl,
  JS, Classes, SysUtils, resources, utils,
  guibase, guictrls,
  gamebase, gameaudio, GameVerlets, GameMath, GameSprite,
  ECS, GameFont, ldmap, ldactor, ldconfig, ldai;

type
  TText = class(TGameElement)
  protected   
    r: Double;
    procedure Update(AGame: TGameBase; ATimeMS: double); override;
    procedure Render(gl: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
  end;

  TLD49Game = class(TGameBase)
  private
    function ScreenToWorld(const APoint: TPVector): TPVector;
    function WindowToGround(const APoint: TPVector): TPVector;
  public
    procedure DoClick(AX, AY: double; AButtons: longword); override;

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
  res:=GetFont('base').Draw(format('%dx%d', [game.width,game.height]));

  v:=AViewport;
  v.Projection:=TPMatrix.Ortho(-game.width/2, game.width/2, game.Height/2, -game.Height/2, -10, 10);
  v.ModelView:=TPMatrix.Identity.Multiply(TPMatrix.CreateTranslation(-res.width/2,-res.Height/2,0));

  TGameFont.Render(gl, res, v, TGameColor.New(1,1,1));
end;

function TLD49Game.ScreenToWorld(const APoint: TPVector): TPVector;
begin
  result:=Viewport.ModelView.Inverse.Transpose
    .Multiply(Viewport.Projection.Inverse.Transpose.Multiply(APoint));
end;

function TLD49Game.WindowToGround(const APoint: TPVector): TPVector;
var
  p, pt, pt2, dir: TPVector;
  t: Double;
begin
  p:=TPVector.New(APoint.X,APoint.Y).Multiply(TPVector.New(2/Width, -2/Height, 1.0)).Sub(TPVector.new(1,-1));

  pt:=ScreenToWorld(p);
  pt2:=ScreenToWorld(p.sub(TPVector.new(0,0,2)));

  dir:=pt2.Sub(pt);
  // z=pt.z+dir.z*t => t=-pt.z/dir.z
  t:=-pt.z/dir.z;

  result:=pt.add(dir.scale(t));
end;

procedure TLD49Game.DoClick(AX, AY: double; AButtons: longword);
var
  pt, p, pt2, dir: TPVector;
  t: Double;
begin
  inherited DoClick(AX, AY, AButtons);

  p:=WindowToGround(TPVector.New(ax,ay));
  Writeln(p.x,' x ',p.y,' x ',p.z);
end;

procedure TLD49Game.InitializeResources;
begin
  inherited InitializeResources;
  TResources.AddImage('assets/custom.png');
  TResources.AddString('assets/custom-msdf.json');

  // Map tiles
  TResources.AddImage('assets/grass.png');
  TResources.AddImage('assets/field.png');
  TResources.AddString('assets/tiles.json');

  TResources.AddImage('assets/barley.png');
  TResources.AddString('assets/barley.json');

  TResources.AddImage('assets/farmer.png');
  TResources.AddString('assets/farmer.json');

  // Misc
  TResources.AddString('assets/config.json');
end;

procedure TLD49Game.AfterLoad;
var
  ch: TLDCharacter;
begin
  inherited AfterLoad;

  LoadConfig(TResources.AddString('assets/config.json').Text);

  AddSprite(TResources.AddString('assets/farmer.json').Text);

  AddSprite(TResources.AddString('assets/barley.json').Text);

  LoadTiles(TResources.AddString('assets/tiles.json').Text);
  LoadFont('base', TResources.AddString('assets/custom-msdf.json').Text, TResources.AddImage('assets/custom.png'));

  AddElement(EntitySystem);
  AddElement(Map);

  //AddElement(ttext.Create(true));

  Map.SetCurrentSector(Map.GetSector(0,0));
  Map.CurrentSector.SetTile(1,1,'field');
  Map.CurrentSector.SetTile(2,2,'field');

  ch:=SpawnCharacter('Bob', 'farmer', 0, 250, 200);
  FarmerBehavior.SetField(ch.Actor, 0, 1,1);
  ch:=SpawnCharacter('Jim', 'farmer', 0, 400, 400);
  FarmerBehavior.SetField(ch.Actor, 0, 2,2);
end;

procedure TLD49Game.AfterResize;
begin
  inherited AfterResize;

  Viewport.Projection:=TPMatrix.Ortho(Width/4, -Width/4, Height/4, -Height/4, -10000, 10000);
  Viewport.ModelView:=TPMatrix.LookAt(TPVector.New(450/2-20,450/2,0),
                                      TPVector.New(300,-300,500),
                                      TPVector.New(0,0,-1));

  //Viewport.ModelView:=TPMatrix.CreateTranslation(-100,0,0);
  //Viewport.ModelView:=TPMatrix.CreateRotationZ(0.5).Multiply(TPMatrix.CreateTranslation(-100,0,0));
end;

begin
  RunGame(TLD49Game);
end.
