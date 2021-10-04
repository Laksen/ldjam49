unit ldactor;

{$mode ObjFPC}

interface

uses
  GameBase, GameSprite, GameMath,
  ECS,
  JS, web, webgl,
  Classes, SysUtils;

type
  TLDCharacter = class;

  TLDActor = class(TECEntity)
  private
    fCharacter: TLDCharacter;
  public
    constructor Create(ASystem: TECSystem; ACharacter: TLDCharacter);

    property Character: TLDCharacter read fCharacter;
  end;

  TLDCharacter = class(TGameElement)
  private
    fAttacking: boolean;
    fAttackSound: TJSHTMLAudioElement;
    fBaseDamage: double;
    fGold: longint;
    fHP: double;
    fTarget: TPVector;
    fName: String;
    fActor: TLDActor;
    fAnimation: string;
    fSpeed: double;
    fSprite: TGameSprite;
    fSector: Integer;
    fTime, fAttackTime, fLastTime: Double;
    function GetAlive: boolean;
  protected
    procedure Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
    procedure Update(AGame: TGameBase; ATimeMS: double); override;
  public
    constructor Create(const AName: string; ASprite: TGameSprite; ASector,AX,AY: integer);

    procedure GoldTransact(AGoldDiff: longint);

    function TriggerAttack: boolean;

    property Name: string read fName;
    property Animation: string read fAnimation write fAnimation;
    property Sector: integer read fSector;
    property Actor: TLDActor read fActor;

    property Alive: boolean read GetAlive;
    property HP: double read fHP write fHP;
    property Speed: double read fSpeed write fSpeed;
    property BaseDamage: double read fBaseDamage write fBaseDamage;

    property Gold: longint read fGold write fGold;

    // Movement
    property Target: TPVector read fTarget write fTarget;
    property Attacking: boolean read fAttacking;

    property AttackSound: TJSHTMLAudioElement read fAttackSound write fAttackSound;
  end;

var
  SectorMax: double;

  Player,
  King: TLDCharacter;

  CharactersVisible,
  Characters: TJSarray;

  Behaviors: TJSMap;

function GetName: string;

procedure DamageAt(AGiver: TLDCharacter; ASector: integer; APosition: TPVector; ADamage: double);

function SpawnCharacter(const AName, AType: string; ASector,AX,AY: integer): TLDCharacter;

function RegisterComponent(const AName: string; AType: TECComponentClass): TECComponent;

procedure ShowCharacters(ASector: longint);

implementation

uses
  ldmap,
  ldsounds,
  ldconfig;

procedure ConfigureCharacter(AChar: TLDCharacter; const AType: string);
var
  cfg: TJSObject;
  beh: JSValue;
begin
  cfg:=TJSObject(Config.Characters.get(AType));

  AChar.HP:=double(cfg['hp']);
  AChar.Speed:=double(cfg['speed']);
  AChar.BaseDamage:=double(cfg['damage']);

  AChar.AttackSound:=GetSound(string(cfg['attacksound']));

  AChar.Target:=AChar.Position;

  for beh in TJSArray(cfg['behavior']) do
    AChar.Actor.AddComponent(TECComponent(Behaviors.get(beh)));
end;

function GetCharacterSprite(const AType: string): TGameSprite;
var
  spriteName: String;
begin
  spriteName:=string(TJSObject(Config.Characters.get(AType))['sprite']);

  result:=GetSprite(spriteName);
end;

function GetCharRect(ACenter: TPVector; AWidth, AHeight: double): TGameQuad;
begin
  result[0]:=ACenter.Add(TPVector.new(-AWidth/2, 0, AHeight));
  result[1]:=ACenter.Add(TPVector.new( AWidth/2, 0, AHeight));
  result[2]:=ACenter.Add(TPVector.new( AWidth/2, 0, 0));
  result[3]:=ACenter.Add(TPVector.new(-AWidth/2, 0, 0));
end;

function GetName: string;
begin
  result:='Bob';
end;

procedure DamageAt(AGiver: TLDCharacter; ASector: integer; APosition: TPVector; ADamage: double);
var
  sqrDist: double;
  ch: TJSArray;
  o: jsvalue;
begin
  sqrDist:=sqr(Config.DamageRange);

  ch:=Characters.filter(function(el: jsvalue; idx: nativeint; arr: tjsarray): boolean
  begin
    result:=(TLDCharacter(el)<>AGiver) and
            (TLDCharacter(el).Sector=ASector) and
            (TLDCharacter(el).Position.Sub(AGiver.position).LengthSqr<sqrDist);
  end);

  for o in ch do
  begin
    writeln('Dealing damage to ',TLDCharacter(o).Actor.Key);
  end;
end;

function SpawnCharacter(const AName, AType: string; ASector, AX, AY: integer): TLDCharacter;
begin
  SectorMax:=Config.SectorSize*config.SectorTiles;

  result:=TLDCharacter.Create(AType, GetCharacterSprite(AType), ASector, ax,ay);
  Characters.push(result);

  ConfigureCharacter(result, atype);

  Game.AddElement(result);
end;

function RegisterComponent(const AName: string; AType: TECComponentClass): TECComponent;
begin
  result:=EntitySystem.RegisterComponent(AType);
  Behaviors.&set(AName, result);
end;

procedure ShowCharacters(ASector: longint);
var
  ch: JSValue;
begin
  CharactersVisible:=TJSArray.new;
  for ch in Characters do
  begin
    TLDCharacter(ch).Visible:=TLDCharacter(ch).Sector=ASector;
    if TLDCharacter(ch).Sector=ASector then
      CharactersVisible.push(TLDCharacter(ch));
  end;
end;

constructor TLDActor.Create(ASystem: TECSystem; ACharacter: TLDCharacter);
begin
  inherited Create(ASystem);
  fCharacter:=ACharacter;
end;

function TLDCharacter.GetAlive: boolean;
begin
  result:=fHP>0;
end;

procedure TLDCharacter.Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport);
var
  frame: TGameFrame;
begin
  if fAttacking then
    frame:=fSprite.GetFrame(fAnimation, fTime-fAttackTime)
  else
    frame:=fSprite.GetFrame(fAnimation, fTime);

  RenderFrame(gl, AViewport, GetCharRect(Position, 40,40), frame);
end;

procedure TLDCharacter.Update(AGame: TGameBase; ATimeMS: double);
var
  fMoveDiff: TPVector;
  fMoveLen, fMaxMove: Double;

  procedure TestTravel(AX,AY: integer; ACorrection: TPVector);
  var
    sec: TLDSector;
  begin
    if Map.HasSector(Map.CurrentSector.X+AX, map.CurrentSector.Y+ay) then
    begin
      sec:=Map.GetSector(Map.CurrentSector.X+AX, map.CurrentSector.Y+ay);

      fSector:=sec.ID;

      Map.SetCurrentSector(sec);
      Position:=position.Add(ACorrection);
    end;
  end;

begin
  inherited Update(AGame, ATimeMS);
  fTime:=ATimeMS/1000;

  if fAttacking then
    if (fTime-fAttackTime)>=fSprite.GetAnimation(fAnimation).AnimationTime then
    begin
      fAttacking:=false;
      fAnimation:='idle';

      // Completed attack, damage nearby
      DamageAt(Self, sector, position, BaseDamage);
    end;

  if not fAttacking then
  begin
    fMoveDiff:=fTarget.Sub(Position);
    fMoveLen:=fMoveDiff.LengthSqr;
    fMaxMove:=(fTime-fLastTime)*fSpeed;

    if sqr(fMaxMove) >= fMoveLen then
    begin
      Position:=fTarget;
      fAnimation:='idle';
    end
    else if fMoveLen>0 then
    begin
      fAnimation:='walk';
      Position:=Position.Add(fMoveDiff.Scale(fMaxMove/sqrt(fMoveLen)));
    end;

    if Self=Player then
    begin
      if position.X>=SectorMax then
        TestTravel(1,0, TPVector.New(-SectorMax,0))
      else if position.X<0 then
        TestTravel(-1,0, TPVector.New(SectorMax,0));

      if position.Y>=SectorMax then
        TestTravel(0, 1, TPVector.New(0,-SectorMax))
      else if position.Y<0 then
        TestTravel(0,-1, TPVector.New(0,SectorMax));
    end;

    Position:=Position.Clamp(TPVector.New(0,0), TPVector.new(SectorMax,SectorMax));
  end;

  fLastTime:=fTime;
end;

constructor TLDCharacter.Create(const AName: string; ASprite: TGameSprite; ASector, AX, AY: integer);
begin
  inherited Create;
  fAttacking:=false;
  fAnimation:='idle';
  fName:=AName;
  fActor:=TLDActor.Create(EntitySystem, self);
  fSprite:=ASprite;
  fSector:=ASector;
  Position:=TPVector.New(ax,ay);
end;

procedure TLDCharacter.GoldTransact(AGoldDiff: longint);
begin
  fGold:=fGold+AGoldDiff;
end;

function TLDCharacter.TriggerAttack: boolean;
begin
  if fAttacking then
    exit(false);

  if (AttackSound<>Nil) and Visible then
    Game.Audio.play(AttackSound, 1);

  fAttackTime:=fTime;
  fAttacking:=true;
  fAnimation:='attack';
  result:=true;
end;

initialization
  Characters:=TJSArray.new;
  Behaviors:=TJSMap.new;

end.

