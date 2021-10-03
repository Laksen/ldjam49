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

  TLDGameState = (
    gsIntro,
    gsMain,
    gsDialog
  );

  TLD49Game = class(TGameBase)
  private
    StartSector: TLDSector;
    State: TLDGameState;

    IntroElements: TJSArray;

  private
    // Main GUI
    MainGUI: TGUI;
    MainGuiPanel: TGUIPanel;

    InvPanel: TGUIPanel;


  private

    function ScreenToWorld(const APoint: TPVector): TPVector;
    function WindowToGround(const APoint: TPVector): TPVector;

    procedure LoadMap(const AStr: string);

    procedure MakeGUI;
  protected
    function GetElements: TJSArray; override;
  public
    procedure DoClick(AX, AY: double; AButtons: longword); override;

    procedure InitializeResources; override;
    procedure AfterLoad; override;

    procedure AfterResize; override;

    constructor Create; override;
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
  res:=GetFont('sans').Draw('Click here to start');

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

function iff(a,b: JSValue): JSValue;
begin
  if a=Undefined then
    result:=b
  else
    result:=a;
end;

procedure TLD49Game.LoadMap(const AStr: string);
var
  info, obj, o2: TJSObject;
  sector, default, tile, typ: String;
  location: TJSArray;
  idx, x, y: Integer;
  sec: TLDSector;
  spawn: JSValue;
  ch: TLDCharacter;
begin
  info:=TJSObject(TJSJSON.parse(AStr));

  for sector in TJSObject.keys(info) do
  begin
    obj:=TJSObject(info[sector]);

    default:=string(obj['default']);
    location:=TJSArray(obj['location']);
                       
    sec:=Map.GetSector(integer(location[0]), integer(location[1]));

    for tile in TJSObject.keys(obj) do
      case tile of
        'location',
        'default': ;

      else
        idx:=strtoint(tile);
        o2:=TJSObject(obj[tile]);

        typ:=string(iff(o2['tile'], default));

        x:=idx mod Config.SectorTiles;
        y:=idx div Config.SectorTiles;

        sec.SetTile(x, y, typ);

        for spawn in tjsarray(iff(o2['spawn'], tjsarray.new())) do
        begin
          //writeln(spawn);
          ch:=SpawnCharacter(GetName, string(spawn), sec.ID, x*Config.SectorSize,y*Config.SectorSize);

          case string(spawn) of
            'farmer':
              FarmerBehavior.SetField(ch.Actor, sec.ID, x,y);
            'player':
              begin
                StartSector:=sec;
                Player:=ch;
              end;
          end;
        end;
      end;
  end;
end;

const
  GUIHeight = 200;

procedure TLD49Game.MakeGUI;
var
  t: TGUILabel;
begin
  MainGuiPanel:=TGUIPanel.Create;
  MainGuiPanel.SetSize(0,Height-GUIHeight,Width,GUIHeight);
  MainGuiPanel.BackGround:=TGameColor.New(1,0,0);
  MainGUI.AddChild(MainGuiPanel);

    InvPanel:=TGUIPanel.Create;
    InvPanel.SetSize(0,0,300,GUIHeight);
    InvPanel.BackGround:=TGameColor.new(0,1,0);
    MainGuiPanel.AddChild(InvPanel);

      t:=TGUILabel.Create;
      t.Caption:='Inventory';
      t.SetSize(0,0,350,0);
      t.Size:=30;
      InvPanel.AddChild(t);
end;

function TLD49Game.GetElements: TJSArray;
begin
  case State of
    gsIntro: result:=IntroElements;
    gsMain:  result:=inherited GetElements;
    gsDialog: result:=TJSArray.new;
  end;
end;

procedure TLD49Game.DoClick(AX, AY: double; AButtons: longword);
var
  p: TPVector;
  h: boolean;
begin
  inherited DoClick(AX, AY, AButtons);

  case State of
    gsIntro:
      State:=gsMain;
    gsMain:
      begin
        MainGUI.DoClick(TGUIPoint.Create(ax,ay), h);

        if not h then
        begin
          p:=WindowToGround(TPVector.New(ax,ay));
          Writeln(p.x,' x ',p.y,' x ',p.z);

          if assigned(player) then
            Player.Target:=p;
        end;
      end;
  end;
end;

procedure TLD49Game.InitializeResources;
begin
  inherited InitializeResources;
  TResources.AddImage('assets/custom.png');
  TResources.AddString('assets/custom-msdf.json');

  // Map tiles
  TResources.AddImage('assets/grass.png');
  TResources.AddImage('assets/field.png');
  TResources.AddImage('assets/barley.png');
  TResources.AddImage('assets/hops.png');

  TResources.AddImage('assets/farmer.png');
  TResources.AddImage('assets/king.png');
  TResources.AddImage('assets/guard.png');
  TResources.AddImage('assets/player.png');

  TResources.AddImage('assets/bld.png');
                                             
  TResources.AddString('assets/tiles.json');

  TResources.AddString('assets/sprites-plants.json');
  TResources.AddString('assets/sprites-characters.json');
  TResources.AddString('assets/sprites-buildings.json');

  // Misc
  TResources.AddString('assets/config.json');

  TResources.AddString('assets/map.json');
end;

procedure TLD49Game.AfterLoad;
begin
  inherited AfterLoad;

  LoadConfig(TResources.AddString('assets/config.json').Text);

  AddSprites(TResources.AddString('assets/sprites-plants.json').Text);
  AddSprites(TResources.AddString('assets/sprites-characters.json').Text);
  AddSprites(TResources.AddString('assets/sprites-buildings.json').Text);

  LoadTiles(TResources.AddString('assets/tiles.json').Text);
  LoadFont('sans', TResources.AddString('assets/custom-msdf.json').Text, TResources.AddImage('assets/custom.png'));

  AddElement(EntitySystem);
  AddElement(Map);

  MainGUI:=TGUI.Create;
  MainGUI.Resize(Width,Height);
  AddElement(MainGUI);

  MakeGUI;

  LoadMap(TResources.AddString('assets/map.json').Text);
  Map.SetCurrentSector(StartSector);
end;

procedure TLD49Game.AfterResize;
begin
  inherited AfterResize;

  Viewport.Projection:=TPMatrix.Ortho(Width/4, -Width/4, Height/4, -Height/4, -10000, 10000);
  Viewport.ModelView:=TPMatrix.LookAt(TPVector.New(450/2-20,450/2-60,0),
                                      TPVector.New(300,-300,500),
                                      TPVector.New(0,0,-1));

  if MainGUI<>nil then
  begin
    MainGUI.Resize(Width,Height);

    MainGuiPanel.SetSize(0,Height-GUIHeight,Width,GUIHeight);
  end;
  //Viewport.ModelView:=TPMatrix.CreateTranslation(-100,0,0);
  //Viewport.ModelView:=TPMatrix.CreateRotationZ(0.5).Multiply(TPMatrix.CreateTranslation(-100,0,0));
end;

constructor TLD49Game.Create;
begin
  inherited Create;
  IntroElements:=TJSArray.new(TText.Create());
end;

begin
  RunGame(TLD49Game);
end.
