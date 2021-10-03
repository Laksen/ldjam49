unit ldai;

{$mode ObjFPC}

interface

uses
  ldactor, ldconfig,
  ECS,
  GameMath,
  Classes, SysUtils, JS;

type
  TFarmerState = (fsFarming);

  TFarmerBehavior = class(TECComponent)
  private const
    UpdateInterval = 3;
  protected
    procedure Init(AEntity: TECEntity); override;

    procedure Update(AEntity: TECEntity; ADeltaMS, ATimeMS: double); override;
  public
    procedure SetField(AEntity: TECEntity; ASector, AX,AY: longint);
  end;

var
  FarmerBehavior: TFarmerBehavior;

implementation

procedure TFarmerBehavior.Init(AEntity: TECEntity);
var
  ent: TJSMap;
begin
  inherited Init(AEntity);
  ent:=GetData(AEntity);

  ent.&set('state', fsFarming);
  ent.&set('farm-sector', 0);
  ent.&set('farm-x', 0);
  ent.&set('farm-y', 0);
  ent.&set('last-update', -100000.0);
end;

procedure TFarmerBehavior.Update(AEntity: TECEntity; ADeltaMS, ATimeMS: double);
var
  ent: TJSMap;
  last_update, x, y: Double;
  char: TLDCharacter;
  newCoord: TPVector;
begin
  ent:=GetData(AEntity);
  char:=TLDActor(AEntity).Character;

  last_update:=double(ent.get('last-update'));
  if (ATimeMS-last_update)>(UpdateInterval*1000) then
  begin
    x:=double(ent.get('farm-x'));
    y:=double(ent.get('farm-x'));

    newCoord:=TPVector.New((x+random)*Config.SectorSize, (y+random)*Config.SectorSize);
    char.MoveTarget:=newCoord;

    ent.&set('last-update', ATimeMS-1000*random);
  end;
end;

procedure TFarmerBehavior.SetField(AEntity: TECEntity; ASector, AX, AY: longint);
var
  ent: TJSMap;
begin
  ent:=GetData(AEntity);

  ent.&set('farm-sector', ASector);
  ent.&set('farm-x', ax);
  ent.&set('farm-y', ay);
end;

initialization
  FarmerBehavior:=TFarmerBehavior(RegisterComponent('farmer', TFarmerBehavior));

end.

