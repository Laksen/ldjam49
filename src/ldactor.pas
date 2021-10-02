unit ldactor;

{$mode ObjFPC}

interface

uses
  GameBase, GameSprite, GameMath,
  ECS,
  JS, webgl,
  Classes, SysUtils;

type
  TLDActor = class(TECEntity)
  public
  end;

  TLDCharacter = class(TGameElement)
  private
    fActor: TLDActor;
    fAnimation: string;
    fSprite: TGameSprite;
    fSector: Integer;
    fTime: Double;
  protected
    procedure Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
    procedure Update(AGame: TGameBase; ATimeMS: double); override;
  public
    constructor Create(ASprite: TGameSprite; ASector,AX,AY: integer);

    property Animation: string read fAnimation write fAnimation;
    property Actor: TLDActor read fActor;
  end;

var
  Player: TLDCharacter;

  Characters: TJSarray;

function SpawnCharacter(const AType: string; ASprite: TGameSprite; ASector,AX,AY: integer): TLDCharacter;

implementation

uses
  ldconfig;

procedure ConfigureCharacter(AChar: TLDCharacter; const AType: string);
begin

end;

function GetCharRect(ACenter: TPVector; AWidth, AHeight: double): TGameQuad;
begin
  result[0]:=ACenter.Add(TPVector.new(-AWidth/2, 0, AHeight));
  result[1]:=ACenter.Add(TPVector.new( AWidth/2, 0, AHeight));
  result[2]:=ACenter.Add(TPVector.new( AWidth/2, 0, 0));
  result[3]:=ACenter.Add(TPVector.new(-AWidth/2, 0, 0));
end;

function SpawnCharacter(const AType: string; ASprite: TGameSprite; ASector, AX, AY: integer): TLDCharacter;
begin
  result:=TLDCharacter.Create(ASprite, ASector, ax,ay);
  Characters.push(result);

  ConfigureCharacter(result, atype);
end;

procedure TLDCharacter.Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport);
var
  frame: TGameFrame;
begin
  frame:=fSprite.GetFrame(fAnimation, fTime);

  RenderFrame(gl, AViewport, GetCharRect(Position, 40,40), frame);
end;

procedure TLDCharacter.Update(AGame: TGameBase; ATimeMS: double);
begin
  inherited Update(AGame, ATimeMS);
  fTime:=ATimeMS/1000;
end;

constructor TLDCharacter.Create(ASprite: TGameSprite; ASector, AX, AY: integer);
begin
  inherited Create;
  fActor:=TLDActor.Create(EntitySystem);
  fSprite:=ASprite;
  fSector:=ASector;
  Position:=TPVector.New(ax,ay);
end;

end.

