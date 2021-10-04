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

  TAction = (aMove, aAttack, aTalk, aUse, aPickUp);

  TLD49Game = class(TGameBase)
  private
    fCurrentAction: TAction;
    StartSector: TLDSector;
    State: TLDGameState;

    IntroElements: TJSArray;
    procedure SetAction(ATarget: TGUIElement; const APosition: TGUIPoint);
    procedure SetCurrentAction(const AValue: TAction);

  private
    // Main GUI
    MainGUI: TGUI;
    MainGuiPanel: TGUIPanel;

    InvPanel: TGUIPanel;
    InvGoldLabel: TGUILabel;
    Inventory: TGUIInventory;

    Actions: array[TAction] of TGUILabel;
    property CurrentAction: TAction read fCurrentAction write SetCurrentAction;
  private

    function ScreenToWorld(const APoint: TPVector): TPVector;
    function WindowToGround(const APoint: TPVector): TPVector;

    procedure LoadMap(const AStr: string);

    procedure MakeGUI;
  protected
    procedure Update(ATimeMS: double); override;
    function GetElements: TJSArray; override;
  public
    procedure DoKeyPress(AKeyCode: string); override;
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

procedure TLD49Game.SetCurrentAction(const AValue: TAction);
begin
  if fCurrentAction=AValue then Exit;                  
  Actions[fCurrentAction].Color:=TGameColor.new(1,1,1);
  fCurrentAction:=AValue;
  Actions[AValue].Color:=TGameColor.new(1,1,0);
end;

procedure TLD49Game.SetAction(ATarget: TGUIElement; const APosition: TGUIPoint);
begin
  CurrentAction:=TAction(ATarget.Tag);
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
          ch:=SpawnCharacter(GetName, string(spawn), sec.ID, x*Config.SectorSize,y*Config.SectorSize);

          case string(spawn) of
            'farmer':
              FarmerBehavior.SetHomeTile(ch.Actor, sec.ID, x,y);
            'player':
              begin
                StartSector:=sec;
                Player:=ch;

                if assigned(king) and assigned(player) then
                  KingBehavior.AddAnnoyance(king.Actor, player.Actor, 1000);
              end;
            'king':
              begin
                King:=ch;
                KingBehavior.SetHomeTile(ch.Actor, sec.ID, x,y);

                if assigned(king) and assigned(player) then
                  KingBehavior.AddAnnoyance(king.Actor, player.Actor, 1000);
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
  ActionPanel: TGUIPanel;
  PanelBG: TGameColor;

  procedure AddAction(AAction: TAction; const ACaption: string; AX,AY: longint);
  var
    btn: TGUILabel;
  begin
    btn:=TGUILabel.Create;
    btn.Caption:=ACaption;
    btn.SetSize(ax,ay,175,50);
    btn.Size:=50;
    btn.Color:=TGameColor.new(1,1,1);
    ActionPanel.AddChild(btn);
    Actions[AAction]:=btn;

    btn.Tag:=integer(AAction);
    btn.OnClick:=@SetAction;
  end;

begin
  PanelBG:=TGameColor.new(0.4,0.4,0.4);;

  MainGUI.Position:=TPVector.New(0,0,1);

  MainGuiPanel:=TGUIPanel.Create;
  MainGuiPanel.SetSize(0,Height-GUIHeight,Width,GUIHeight);
  MainGuiPanel.BackGround:=TGameColor.New(1,0,0);
  MainGUI.AddChild(MainGuiPanel);

    InvPanel:=TGUIPanel.Create;
    InvPanel.SetSize(0,2,350,GUIHeight-2);
    InvPanel.BackGround:=PanelBG;
    MainGuiPanel.AddChild(InvPanel);

      t:=TGUILabel.Create;
      t.Caption:='Inventory';
      t.SetSize(0,0,350,30);
      t.Size:=30;
      InvPanel.AddChild(t);

      InvGoldLabel:=TGUILabel.Create;
      InvGoldLabel.Caption:='Gold: 0';
      InvGoldLabel.SetSize(0,30,350,30);
      InvGoldLabel.Size:=30;
      InvPanel.AddChild(InvGoldLabel);

      Inventory:=TGUIInventory.Create;
      Inventory.ItemWidth:=350 div 3;
      Inventory.SetSize(0,60,350,GUIHeight-60);
      InvPanel.AddChild(Inventory);

      Inventory.AddElements(GetSprite('icon-hops'), 'idle', 10);
      Inventory.AddElements(GetSprite('icon-barley'), 'idle', 10);
      Inventory.AddElements(GetSprite('icon-scythe'), 'idle', 1);
      Inventory.AddElements(GetSprite('icon-beer-reg'), 'idle', 1);
      Inventory.AddElements(GetSprite('icon-beer-med'), 'idle', 1);
      Inventory.AddElements(GetSprite('icon-beer-strong'), 'idle', 1337);
      Inventory.AddElements(GetSprite('icon-beer-suicide'), 'idle', 1);

    ActionPanel:=TGUIPanel.Create;
    ActionPanel.SetSize(352,2,350, GUIHeight-2);
    ActionPanel.BackGround:=PanelBG;
    MainGuiPanel.AddChild(ActionPanel);

      AddAction(aMove,   'Move',   0,  0);
      AddAction(aAttack, 'Attack', 175,0);
      AddAction(aTalk,   'Talk',   0,  50);
      AddAction(aUse,    'Use',    175,50);
      AddAction(aPickUp, 'Pick up',0,  100);

      SetCurrentAction(aAttack);
      SetCurrentAction(aMove);
end;

procedure TLD49Game.Update(ATimeMS: double);
begin
  inherited Update(ATimeMS);
  InvGoldLabel.Caption:=Format('Gold: %d', [Player.Gold]);;
end;

function TLD49Game.GetElements: TJSArray;
begin
  case State of
    gsIntro: result:=IntroElements;
    gsMain:  result:=inherited GetElements;
    gsDialog: result:=TJSArray.new;
  end;
end;

procedure TLD49Game.DoKeyPress(AKeyCode: string);
begin
  if AKeyCode='Escape' then
    CurrentAction:=aMove;
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

  TResources.AddImage('assets/Characters/peasant.png');
  TResources.AddImage('assets/Characters/king.png');
  TResources.AddImage('assets/guard.png');
  TResources.AddImage('assets/Characters/player.png');
  TResources.AddImage('assets/well.png');
  TResources.AddImage('assets/castle.png');

  TResources.AddImage('assets/Icons/IconHops.png');
  TResources.AddImage('assets/Icons/IconBarley.png');
  TResources.AddImage('assets/Icons/IconScythe.png');
  TResources.AddImage('assets/Icons/IconBeerREG.png');
  TResources.AddImage('assets/Icons/IconBeerMED.png');
  TResources.AddImage('assets/Icons/IconBeerSTRONG.png');
  TResources.AddImage('assets/Icons/IconBeerSuicide.png');

  TResources.AddImage('assets/bld.png');

  TResources.AddImage('assets/misc.png');
                                             
  TResources.AddString('assets/tiles.json');

  TResources.AddString('assets/sprites-icons.json');
  TResources.AddString('assets/sprites-plants.json');
  TResources.AddString('assets/sprites-characters.json');
  TResources.AddString('assets/sprites-buildings.json');
  TResources.AddString('assets/sprites-misc.json');

  // Misc
  TResources.AddString('assets/config.json');

  TResources.AddString('assets/map.json');
end;

procedure TLD49Game.AfterLoad;
var
  i: Integer;
begin
  inherited AfterLoad;

  LoadConfig(TResources.AddString('assets/config.json').Text);

  AddSprites(TResources.AddString('assets/sprites-icons.json').Text);
  AddSprites(TResources.AddString('assets/sprites-plants.json').Text);
  AddSprites(TResources.AddString('assets/sprites-characters.json').Text);
  AddSprites(TResources.AddString('assets/sprites-buildings.json').Text);
  AddSprites(TResources.AddString('assets/sprites-misc.json').Text);

  LoadTiles(TResources.AddString('assets/tiles.json').Text);
  LoadFont('sans', TResources.AddString('assets/custom-msdf.json').Text, TResources.AddImage('assets/custom.png'));

  AddElement(EntitySystem);
  AddElement(Map);

  MainGUI:=TGUI.Create;
  MainGUI.Resize(Width,Height);
  AddElement(MainGUI);

  MakeGUI;

  for i:=0 to 3 do
    SectorArrows[i]:=TLDSectorButton(AddElement(TLDSectorButton.Create(i)));

  LoadMap(TResources.AddString('assets/map.json').Text);
  Map.SetCurrentSector(StartSector);
end;

procedure TLD49Game.AfterResize;
begin
  inherited AfterResize;

  Viewport.Projection:=TPMatrix.Ortho(Width/4, -Width/4, Height/4, -Height/4, -10000, 10000);
  Viewport.ModelView:=TPMatrix.LookAt(//TPVector.New(450/2-20,450/2-60,0),
                                      TPVector.New(450/2,450/2,0),
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
