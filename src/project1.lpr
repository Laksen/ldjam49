program project1;

{$mode objfpc}

uses
  math,
  Web, webgl,
  JS, Classes, SysUtils, resources, utils,
  guibase, guictrls,
  gamebase, gameaudio, GameVerlets, GameMath, GameSprite,
  ECS, GameFont, ldmap, ldactor, ldconfig, ldai, ldsounds;

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

  TAction = (aMove, aAttack, aTalk, aUse, aPickUp, aDrop);

  TLD49Game = class(TGameBase)
  private
    fCurrentAction: TAction;
    StartSector: TLDSector;
    State: TLDGameState;

    IntroElements: TJSArray;
    procedure SetAction(ATarget: TGUIElement; const APosition: TGUIPoint);
    procedure SetCurrentAction(const AValue: TAction);
  private
    // Dialog stuff
    DialogElements: TJSArray;

    DialogGUI: TGUI;     
    DialogBackH: TGUIPanel;

    DialogIcon: TGUIImage;
    DialogText: TGUILabel;
    DialogOptions: TGUIDialogs;

    DialogTarget: jsvalue;
    DialogStack: TJSArray;

    DialogCfg: TJSObject;

    function HasBeer: boolean;
    function WantsBeer(ATarget: jsvalue): boolean;

    procedure ClickDialog(AIndex: longint);
    procedure TriggerDialog(ATarget: JSValue; ADialog: string; APush: boolean = true);
    procedure TriggerDialog(ADialog: TJSObject; APush: boolean);

    procedure MakeDialog;
  private
    // Main GUI
    MainGUI: TGUI;
    MainGuiPanel: TGUIPanel;

    InvPanel: TGUIPanel;
    InvGoldLabel: TGUILabel;
    Inventory: TGUIInventory;

    Actions: array[TAction] of TGUILabel;
    property CurrentAction: TAction read fCurrentAction write SetCurrentAction;

    procedure AddInventory(ASprite: string; ACount: integer);
    function HasInventory(ASprite: string; ACount: integer): boolean;
    function RemoveInventory(ASprite: string; ACount: integer): boolean;

    procedure DropItem(AName: string; ASector: TLDSector; APosition: TPVector);
    procedure ClickInventory(AItem: TGameSprite);
  private
    procedure WriteStatus(const AMessage: string);

    function FindBBsInSector: TJSArray;                   

    function FindNPC(ATarget: TPVector): TLDCharacter;

    function FindUseTarget(ATarget: TPVector): TBillboard;

    function FindItemTarget(ATarget: TPVector): TBillboard;
    function FindHarvestTarget(ATarget: TPVector): TPlant;

    procedure PerformAction(ATarget: TPVector);
  private
    function ScreenToWorld(const APoint: TPVector): TPVector;
    function WindowToGround(const APoint: TPVector): TPVector;

    procedure LoadMap(const AStr: string);

    procedure MakeGUI;
  private
    fCurrentTrack: longint;
    Tracks: array[0..1] of TJSHTMLAudioElement;
    fCurrentMusic: TGameAudioSource;

    procedure MusicEnded(ASrc: TGameAudioSource);
    procedure StartMusic;
  protected
    procedure Update(ATimeMS: double); override;
    function GetElements: TJSArray; override;
  public
    procedure DoKeyPress(AKeyCode: string); override;
    procedure DoClick(AX, AY: double; AButtons: longword); override;
    procedure DoMove(AX, AY: double); override;

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

function TLD49Game.HasBeer: boolean;
begin
  result:=(Inventory.ElementCount(GetSprite('icon-beer-reg'))>0) or
          (Inventory.ElementCount(GetSprite('icon-beer-med'))>0) or
          (Inventory.ElementCount(GetSprite('icon-beer-strong'))>0) or
          (Inventory.ElementCount(GetSprite('icon-beer-suicide'))>0);
end;

function TLD49Game.WantsBeer(ATarget: jsvalue): boolean;
begin
  result:=true;
end;

procedure TLD49Game.ClickDialog(AIndex: longint);
var
  curr, selected: TJSObject;

  procedure Consume(agrain, ahops, awater: integer);
  begin
    Inventory.RemoveElements(getsprite('icon-barley'), agrain);
    Inventory.RemoveElements(getsprite('icon-hops'), ahops);

    Inventory.RemoveElements(getsprite('icon-full-bucket'), awater);
    Inventory.AddElements(getsprite('icon-bucket'), awater);
  end;

begin
  curr:=TJSObject(DialogStack[DialogStack.Length-1]);

  if AIndex=-1 then
  begin
    // Back, push top stack
    DialogStack.splice(DialogStack.Length-1);

    if DialogStack.Length>0 then
      TriggerDialog(TJSObject(DialogStack[DialogStack.length-1]), false)
    else
      State:=gsMain;
  end
  else
  begin
    selected:=TJSObject(TJSArray(curr['entries'])[AIndex]);

    if selected['subdialog']<>undefined then
    begin
      TriggerDialog(TJSObject(DialogCfg[string(selected['subdialog'])]), true);
    end
    else if selected['trigger']<>undefined then
    begin
      state:=gsMain;
                                                 
      DialogStack:=TJSArray.new;

      case string(selected['trigger']) of
        'buy_harvest': ;
        'buy_beer':;
        'give_beer':;

        'brew_pilsner':
          begin
            Consume(10, 3, 1);
            Inventory.AddElements(GetSprite('icon-beer-reg'), 2);
          end;
        'brew_ale':
          begin
            Consume(15, 4, 1);
            Inventory.AddElements(GetSprite('icon-beer-med'), 2);
          end;
        'brew_porter':
          begin
            Consume(30, 10, 1);
            Inventory.AddElements(GetSprite('icon-beer-strong'), 2);
          end;
      end;
    end
    else
      writeln('Dead end?!');
  end;
end;
  
procedure TLD49Game.TriggerDialog(ATarget: JSValue; ADialog: string; APush: boolean);
var
  curr: TJSObject;
begin
  State:=gsDialog;
  DialogTarget:=ATarget;

  curr:=TJSObject(DialogCfg[adialog]);

  TriggerDialog(curr, apush);
end;

procedure TLD49Game.TriggerDialog(ADialog: TJSObject; APush: boolean);
var
  ent2: TJSObject;
  ent: jsvalue;
  idx: Integer;
  avail: Boolean;
begin                   
  if APush then
    DialogStack.push(ADialog);

  DialogIcon.Sprite:=GetSprite(string(ADialog['icon']));
  DialogIcon.Animation:=string(ADialog['animation']);

  DialogText.Caption:=string(ADialog['start']);

  DialogOptions.Clear;

  idx:=0;
  for ent in TJSArray(ADialog['entries']) do
  begin
    ent2:=TJSObject(ent);

    avail:=true;

    if ent2['gold']<>undefined then avail:=avail and (integer(ent2['gold'])<=Player.Gold);

    if ent2['beer']<>undefined then avail:=avail and HasBeer and WantsBeer(DialogTarget);

    if ent2['grain']<>undefined then avail:=avail and (Inventory.ElementCount(GetSprite('icon-barley'))>=integer(ent2['grain']));
    if ent2['hops']<>undefined  then avail:=avail and (Inventory.ElementCount(GetSprite('icon-hops'))>=integer(ent2['hops']));
    if ent2['water']<>undefined then avail:=avail and (Inventory.ElementCount(GetSprite('icon-full-bucket'))>=integer(ent2['water']));

    if avail then
      DialogOptions.AddItem(idx, string(ent2['option']));
    inc(idx);
  end;

  if ADialog['no_exit']=undefined then
    DialogOptions.AddItem(-1, 'Back');
end;

procedure TLD49Game.MakeDialog;
const
  DW = 800;
  DH = 600;
var
  DialogPanel: TGUIPanel;
begin
  DialogGUI:=TGUI.create;
  DialogGUI.Resize(Width, Height);

  DialogElements:=TJSArray.new;
  DialogElements.push(DialogGUI);

  DialogBackH:=TGUIPanel.Create;
  DialogBackH.SetSize(0,0,Width,Height);
  DialogBackH.BackGround:=TGameColor.New(0.3,0.3,0.3);
  DialogGUI.AddChild(DialogBackH);

  DialogPanel:=TGUIPanel.Create;
  DialogPanel.BackGround:=TGameColor.New(0.8,0.8,0.8);
  DialogPanel.SetSize((Width-DW) div 2, (Height-DH) div 2, DW,DH);
  DialogGUI.AddChild(DialogPanel);

  DialogIcon:=TGUIImage.Create;
  DialogIcon.SetSize(0,0,256,256);
  DialogPanel.AddChild(DialogIcon);

  DialogText:=TGUILabel.Create;
  DialogText.SetSize(256,0,DW-256,DH-5*30);
  DialogText.Size:=30;
  DialogText.Font:='sans';
  DialogText.Caption:='test';
  DialogPanel.AddChild(DialogText);

  DialogOptions:=TGUIDialogs.Create;
  DialogOptions.SetSize(0,DH-5*30, DW,5*30);
  DialogOptions.ItemHeight:=30;
  DialogOptions.BackGround:=TGameColor.New(0.85,0.85,0.85);
  DialogOptions.HoverColor:=TGameColor.New(1,1,1);
  DialogOptions.OnClickItem:=@ClickDialog;
  DialogPanel.AddChild(DialogOptions);
end;

procedure TLD49Game.AddInventory(ASprite: string; ACount: integer);
begin
  Inventory.AddElements(GetSprite(ASprite), acount);
end;

function TLD49Game.HasInventory(ASprite: string; ACount: integer): boolean;
begin
  result:=Inventory.ElementCount(GetSprite(ASprite))>=ACount;
end;

function TLD49Game.RemoveInventory(ASprite: string; ACount: integer): boolean;
begin
  result:=Inventory.RemoveElements(GetSprite(ASprite), acount);
end;

procedure TLD49Game.DropItem(AName: string; ASector: TLDSector; APosition: TPVector);
var
  fCurrentTile: TLDSectorTile;
  bb: TBillboard;
begin
  fCurrentTile:=ASector.GetTileAt(APosition);

  bb:=TileComp.AddBillboard(fCurrentTile, GetSprite(AName), 'idle', 20,20);
  bb.Position:=APosition;
  bb.IsItem:=true;
  bb.Visible:=true;
end;

procedure TLD49Game.SetAction(ATarget: TGUIElement; const APosition: TGUIPoint);
begin
  CurrentAction:=TAction(ATarget.Tag);
end;

procedure TLD49Game.ClickInventory(AItem: TGameSprite);
begin
  case CurrentAction of
    aDrop:
      begin
        RemoveInventory(AItem.Name, 1);

        DropItem(AItem.Name, Map.CurrentSector, Player.Position);

        Audio.Play(TResources.AddSound('assets/Audio/proc_plop.m4a'), 1);
      end;
    aUse:
      begin
        case AItem.Name of
          'icon-beer-reg',
          'icon-beer-med',
          'icon-beer-strong',
          'icon-beer-suicide':
            begin
              writestatus('Drink '+AItem.Name+'!');
              Game.Audio.Play(GetSound('drink'), 0.8);
              RemoveInventory(aitem.Name, 1);
            end;
        else
          WriteStatus('You can''t do that');
        end;
      end;
  else
    WriteStatus('You can''t do that');
  end;
end;

procedure TLD49Game.WriteStatus(const AMessage: string);
begin
  writeln(amessage);
end;

function TLD49Game.FindBBsInSector: TJSArray;
var
  i, i2: Integer;
begin
  result:=TJSArray.new;

  for i:=0 to Config.SectorTiles-1 do
    for i2:=0 to config.SectorTiles-1 do
      result:=result.concat(TileComp.GetItems(Map.CurrentSector.Tiles[i][i2]));
end;

function TLD49Game.FindNPC(ATarget: TPVector): TLDCharacter;
var
  things: TJSArray;
begin
  result:=nil;

  things:=CharactersVisible;

  things:=things.filter(function(e: jsvalue; i: nativeint; a: tjsarray): boolean begin
    result:=TLDCharacter(e).Alive and
      (TLDCharacter(e)<>player) and
      (tplant(e).Position.sub(atarget).LengthSqr<sqr(Config.PlayerReach))
  end);

  if things.Length<=0 then exit(nil);

  things:=things.sort(function(a,b: jsvalue): nativeint begin
    result:=round(tplant(a).Position.sub(atarget).LengthSqr) - round(tplant(b).Position.sub(atarget).LengthSqr)
  end);

  result:=TLDCharacter(things[0]);
end;

function TLD49Game.FindUseTarget(ATarget: TPVector): TBillboard;
var
  things: TJSArray;
begin
  result:=nil;

  things:=FindBBsInSector();

  things:=things.filter(function(e: jsvalue; i: nativeint; a: tjsarray): boolean begin
    result:=(not TBillboard(e).IsItem) and
      (tplant(e).Position.sub(atarget).LengthSqr<sqr(Config.PlayerReach))
  end);

  if things.Length<=0 then exit(nil);

  things:=things.sort(function(a,b: jsvalue): nativeint begin
    result:=round(tplant(a).Position.sub(atarget).LengthSqr) - round(tplant(b).Position.sub(atarget).LengthSqr)
  end);

  result:=TBillboard(things[0]);
end;

function TLD49Game.FindItemTarget(ATarget: TPVector): TBillboard;
var
  things: TJSArray;
begin
  result:=nil;

  things:=FindBBsInSector();

  things:=things.filter(function(e: jsvalue; i: nativeint; a: tjsarray): boolean begin
    result:=TBillboard(e).IsItem and
      (tplant(e).Position.sub(atarget).LengthSqr<sqr(Config.PlayerReach))
  end);

  if things.Length<=0 then exit(nil);

  things:=things.sort(function(a,b: jsvalue): nativeint begin
    result:=round(tplant(a).Position.sub(atarget).LengthSqr) - round(tplant(b).Position.sub(atarget).LengthSqr)
  end);

  result:=TBillboard(things[0]);
end;

function TLD49Game.FindHarvestTarget(ATarget: TPVector): TPlant;
var
  tile: TLDSectorTile;
  plants: TJSArray;
begin
  tile:=Map.CurrentSector.GetTileAt(atarget);

  plants:=tjsarray.new;
  if tile.HasComponent(FieldComp) then plants:=FieldComp.GetPlants(tile)
  else if tile.HasComponent(HopsComp) then plants:=HopsComp.GetPlants(tile);

  plants:=plants.filter(function(e: jsvalue; i: nativeint; a: tjsarray): boolean begin
    result:=TPlant(e).Ready and
      (tplant(e).Position.sub(atarget).LengthSqr<sqr(Config.PlayerReach))
  end);

  if plants.Length<=0 then exit(nil);

  plants:=plants.sort(function(a,b: jsvalue): nativeint begin
    result:=round(tplant(a).Position.sub(atarget).LengthSqr) - round(tplant(b).Position.sub(atarget).LengthSqr)
  end);

  result:=TPlant(plants[0])
end;

procedure TLD49Game.PerformAction(ATarget: TPVector);
var
  targ: TBillboard;
  targharvest: TPlant;
  char: TLDCharacter;
begin
  //writeln('action! ', CurrentAction);
  case CurrentAction of
    aAttack:
      Player.TriggerAttack;
    aTalk:
      begin
        char:=FindNPC(ATarget);

        if char<>nil then
        begin
          TriggerDialog(char, char.Name);
        end
        else
          WriteStatus('No one to talk to here');
      end;
    aUse:
      begin
        targ:=FindUseTarget(ATarget);

        if targ<>nil then
          case targ.Sprite.Name of
            'well':
              begin
                if RemoveInventory('icon-bucket', 1) then
                begin
                  AddInventory('icon-full-bucket', 1);
                  Audio.Play(GetSound('drop'), 1);
                end
                else
                  WriteStatus('You need a bucket for the water');
              end;
            'fireplace':
              TriggerDialog(nil, 'cauldron');
          else
            targ:=nil;
          end
        else
        begin
          WriteStatus('Nothing to use here');
          exit;
        end;


        if targ=nil then
        begin
          WriteStatus('Can not use this');
          exit;
        end
      end;
    aPickUp:
      begin  
        targ:=FindItemTarget(ATarget);
        targharvest:=nil;

        if targ=nil then
          targharvest:=FindHarvestTarget(ATarget);

        if targ<>nil then
        begin
          AddInventory(targ.Sprite.name, 1);
          TileComp.RemoveBillboard(targ.Tile, targ);

          Audio.Play(GetSound('pickup'), 1);
        end
        else if targharvest<>nil then
        begin
          if HasInventory('icon-scythe',1)  then
          begin
            targharvest.Harvest;
            // Todo: Anger farmer

            if targharvest.Name='barley' then
              AddInventory('icon-barley', config.BarleyHarvest)
            else
              AddInventory('icon-hops', config.HopsHarvest);

            Audio.Play(GetSound('harvest'), 1);
          end
          else
            WriteStatus('You do not have anything to harvest this with');
        end
        else
          WriteStatus('Nothing to pick up here');
      end;
    aDrop: ;
  end;
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
            'guard':
              GuardBehavior.SetHomeTile(ch.Actor, sec.ID, x,y);
            'player':
              begin
                StartSector:=sec;
                Player:=ch;
              end;
            'king':
              begin
                King:=ch;
                KingBehavior.SetHomeTile(ch.Actor, sec.ID, x,y);
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
      Inventory.HoverColor:=TGameColor.New(0.6,0.6,0.6);
      InvPanel.AddChild(Inventory);

      Inventory.OnClickItem:=@ClickInventory;

      AddInventory('icon-beer-reg', 1);
      AddInventory('icon-bucket', 1);
      AddInventory('icon-scythe', 1);

    ActionPanel:=TGUIPanel.Create;
    ActionPanel.SetSize(352,2,350, GUIHeight-2);
    ActionPanel.BackGround:=PanelBG;
    MainGuiPanel.AddChild(ActionPanel);

      AddAction(aMove,   'Move',   0,  0);
      AddAction(aAttack, 'Attack', 175,0);
      AddAction(aTalk,   'Talk',   0,  50);
      AddAction(aUse,    'Use',    175,50);
      AddAction(aPickUp, 'Pick up',0,  100);
      AddAction(aDrop,   'Drop',   175,  100);

      SetCurrentAction(aAttack);
      SetCurrentAction(aMove);
end;

var
  fTime: Double;

procedure TLD49Game.MusicEnded(ASrc: TGameAudioSource);
begin
  fCurrentMusic.FadeOut(fTime,1);

  fCurrentTrack:=(fCurrentTrack+1) mod length(Tracks);
  fCurrentMusic:=Audio.Play(Tracks[fCurrentTrack], 0.4);
  fCurrentMusic.OnEnd:=@MusicEnded;
end;

procedure TLD49Game.StartMusic;
begin
  fCurrentTrack:=0;

  fCurrentMusic:=Audio.Play(Tracks[0], 0.4);
  fCurrentMusic.OnEnd:=@MusicEnded;
end;

procedure TLD49Game.Update(ATimeMS: double);
begin
  inherited Update(ATimeMS);
  fTime:=ATimeMS;
  InvGoldLabel.Caption:=Format('Gold: %d', [Player.Gold]);


end;

function TLD49Game.GetElements: TJSArray;
begin
  case State of
    gsIntro: result:=IntroElements;
    gsMain:  result:=inherited GetElements;
    gsDialog: result:=DialogElements;
  end;
end;

procedure TLD49Game.DoKeyPress(AKeyCode: string);
begin
  case AKeyCode of
    'Escape': CurrentAction:=aMove;
    'Digit1': CurrentAction:=aMove;
    'Digit2': CurrentAction:=aAttack;
    'Digit3': CurrentAction:=aTalk;
    'Digit4': CurrentAction:=aUse;
    'Digit5': CurrentAction:=aPickUp;
    'Digit6': CurrentAction:=aDrop;

    'KeyM': Audio.FadeAll(fTime, 400);
    'KeyN': MusicEnded(nil);

    'KeyF': Audio.Play(GetSound('burp'), 0.3)
  else
    writeln(AKeyCode);
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
      begin
        State:=gsMain;

        StartMusic;
      end;
    gsMain:
      begin
        MainGUI.DoClick(TGUIPoint.Create(ax,ay), h);

        if not h then
        begin
          p:=WindowToGround(TPVector.New(ax,ay));

          if assigned(player) then
            Player.Target:=p;

          if p.Sub(player.Position).LengthSqr<=sqr(config.PlayerReach) then
            PerformAction(p); // Within range
        end;
      end;
    gsDialog:
      DialogGUI.DoClick(TGUIPoint.Create(ax,ay), h);
  end;
end;

procedure TLD49Game.DoMove(AX, AY: double);
var
  h: boolean;
  c: TGUIElement;
begin
  inherited DoMove(AX, AY);
                 
  case State of
    gsMain:
      MainGUI.DoMove(TGUIPoint.Create(ax,ay), h, c);
    gsDialog:
      DialogGUI.DoMove(TGUIPoint.Create(ax,ay), h, c);
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
  TResources.AddImage('assets/fireplace.png');
  TResources.AddImage('assets/castle.png');

  TResources.AddImage('assets/Icons/IconBullet.png');
  TResources.AddImage('assets/Icons/IconBucket.png');
  TResources.AddImage('assets/Icons/IconBucketFull.png');
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
  TResources.AddString('assets/dialog.json');

  TResources.AddString('assets/config.json');

  TResources.AddString('assets/map.json');

  // Sounds
  Tracks[0]:=TResources.AddSound('assets/Audio/mus_song1.mp3');
  Tracks[1]:=TResources.AddSound('assets/Audio/mus_song2.mp3');

  AddSound('rake', TResources.AddSound('assets/Audio/proc_rake.m4a'));
  AddSound('drink', TResources.AddSound('assets/Audio/proc_drinkaah.m4a'));
  TResources.AddSound('assets/Audio/proc_burp.m4a');
  TResources.AddSound('assets/Audio/proc_clunk.m4a');
  AddSound('harvest', TResources.AddSound('assets/Audio/proc_harvest.m4a'));
  AddSound('pickup', TResources.AddSound('assets/Audio/proc_pickup.m4a'));
  AddSound('drop', TResources.AddSound('assets/Audio/proc_plop.m4a'));
                                                                                 
  AddSound('kingattack', TResources.AddSound('assets/Audio/proc_kingspeech.m4a'));
  AddSound('guardattack', TResources.AddSound('assets/Audio/proc_guardattack.m4a'));
  AddSound('playerattack', TResources.AddSound('assets/Audio/proc_slap.m4a'));

  AddSound('death', TResources.AddSound('assets/Audio/battlecryDeath.m4a'));
  AddSound('death', TResources.AddSound('assets/Audio/uuaah.m4a'));
  AddSound('death', TResources.AddSound('assets/Audio/wargh.m4a'));

  AddSound('burp', TResources.AddSound('assets/Audio/burp.m4a'));
  AddSound('burp', TResources.AddSound('assets/Audio/burp2.m4a'));
  AddSound('burp', TResources.AddSound('assets/Audio/Ofart.m4a'));
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

  DialogCfg:=TJSObject(TJSJSON.parse(TResources.AddString('assets/dialog.json').Text));

  LoadTiles(TResources.AddString('assets/tiles.json').Text);
  LoadFont('sans', TResources.AddString('assets/custom-msdf.json').Text, TResources.AddImage('assets/custom.png'));

  AddElement(EntitySystem);
  AddElement(Map);

  MainGUI:=TGUI.Create;
  MainGUI.Resize(Width,Height);
  AddElement(MainGUI);

  MakeGUI;

  MakeDialog;

  for i:=0 to 3 do
    SectorArrows[i]:=TLDSectorButton(AddElement(TLDSectorButton.Create(i)));

  LoadMap(TResources.AddString('assets/map.json').Text);
  Map.SetCurrentSector(StartSector);
end;

procedure TLD49Game.AfterResize;
begin
  inherited AfterResize;

  Viewport.Projection:=TPMatrix.Ortho(Width/4, -Width/4, Height/4, -Height/4, -10000, 10000);
  Viewport.ModelView:=TPMatrix.LookAt(TPVector.New(450/2,450/2,0),
                                      TPVector.New(300,-300,500),
                                      TPVector.New(0,0,-1));

  if MainGUI<>nil then
  begin
    MainGUI.Resize(Width,Height);

    MainGuiPanel.SetSize(0,Height-GUIHeight,Width,GUIHeight);
  end;

  if DialogGUI<>nil then
  begin      
    DialogGUI.Resize(Width,Height);

    DialogBackH.SetSize(0,0,Width,Height);
  end;
  //Viewport.ModelView:=TPMatrix.CreateTranslation(-100,0,0);
  //Viewport.ModelView:=TPMatrix.CreateRotationZ(0.5).Multiply(TPMatrix.CreateTranslation(-100,0,0));
end;

constructor TLD49Game.Create;
begin
  inherited Create;
  DialogStack:=TJSArray.new;
  IntroElements:=TJSArray.new(TText.Create());
end;

begin
  RunGame(TLD49Game);
end.
