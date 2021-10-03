unit ldactor;

{$mode ObjFPC}

interface

uses
  GameBase, GameSprite, GameMath,
  ECS,
  JS, webgl,
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
    fBaseDamage: double;
    fHP: double;
    fMoveTarget: TPVector;
    fName: String;
    fActor: TLDActor;
    fAnimation: string;
    fSpeed: double;
    fSprite: TGameSprite;
    fSector: Integer;
    fTime, fLastTime: Double;
  protected
    procedure Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
    procedure Update(AGame: TGameBase; ATimeMS: double); override;
  public
    constructor Create(const AName: string; ASprite: TGameSprite; ASector,AX,AY: integer);

    property Name: string read fName;
    property Animation: string read fAnimation write fAnimation;
    property Actor: TLDActor read fActor;

    property HP: double read fHP write fHP;
    property Speed: double read fSpeed write fSpeed;
    property BaseDamage: double read fBaseDamage write fBaseDamage;

    // Movement
    property MoveTarget: TPVector read fMoveTarget write fMoveTarget;
  end;

var
  Player: TLDCharacter;

  Characters: TJSarray;

  Behaviors: TJSMap;

function SpawnCharacter(const AName, AType: string; ASector,AX,AY: integer): TLDCharacter;

function RegisterComponent(const AName: string; AType: TECComponentClass): TECComponent;

implementation

uses
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

  for beh in TJSArray(cfg['behavior']) do
    EntitySystem.AddComponent(AChar.Actor, TECComponent(Behaviors.get(beh)));
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

function SpawnCharacter(const AName, AType: string; ASector, AX, AY: integer): TLDCharacter;
begin
  result:=TLDCharacter.Create(AName, GetCharacterSprite(AType), ASector, ax,ay);
  Characters.push(result);

  ConfigureCharacter(result, atype);

  Game.AddElement(result);
end;

function RegisterComponent(const AName: string; AType: TECComponentClass): TECComponent;
begin
  result:=EntitySystem.RegisterComponent(AType);
  Behaviors.&set(AName, result);
end;

constructor TLDActor.Create(ASystem: TECSystem; ACharacter: TLDCharacter);
begin
  inherited Create(ASystem);
  fCharacter:=ACharacter;
end;

procedure TLDCharacter.Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport);
var
  frame: TGameFrame;
begin
  frame:=fSprite.GetFrame(fAnimation, fTime);

  RenderFrame(gl, AViewport, GetCharRect(Position, 40,40), frame);
end;

procedure TLDCharacter.Update(AGame: TGameBase; ATimeMS: double);
var
  fMoveDiff: TPVector;
  fMoveLen, fMaxMove: Double;
begin
  inherited Update(AGame, ATimeMS);
  fTime:=ATimeMS/1000;

  fMoveDiff:=fMoveTarget.Sub(Position);
  fMoveLen:=fMoveDiff.LengthSqr;
  fMaxMove:=(fTime-fLastTime)*fSpeed;

  if fMaxMove >= fMoveLen then
    Position:=fMoveTarget
  else if fMoveLen>0 then
    Position:=Position.Add(fMoveDiff.Scale(fMaxMove/sqrt(fMoveLen)));

  fLastTime:=fTime;
end;

constructor TLDCharacter.Create(const AName: string; ASprite: TGameSprite; ASector, AX, AY: integer);
begin
  inherited Create;
  fAnimation:='idle';
  fName:=AName;
  fActor:=TLDActor.Create(EntitySystem, self);
  fSprite:=ASprite;
  fSector:=ASector;
  Position:=TPVector.New(ax,ay);
end;

initialization
  Characters:=TJSArray.new;
  Behaviors:=TJSMap.new;

end.

