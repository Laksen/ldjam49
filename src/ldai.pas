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

  TNPCBehavior = class(TECComponent)
  end;

  TFarmerBehavior = class(TNPCBehavior)
  private const
    UpdateInterval = 3;
  protected
    procedure Init(AEntity: TECEntity); override;

    procedure Update(AEntity: TECEntity; ADeltaMS, ATimeMS: double); override;
  public
    procedure SetField(AEntity: TECEntity; ASector, AX,AY: longint);
  end;

  TPlayerBehavior = class(TECComponent)
  end;

  TGuardBehavior = class(TNPCBehavior)
  end;

  TKingBehavior = class(TNPCBehavior)
  end;

var
  FarmerBehavior: TFarmerBehavior;
  GuardBehavior:  TGuardBehavior;
  KingBehavior:   TKingBehavior;
  PlayerBehavior: TPlayerBehavior;

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
  state: TFarmerState;
begin
  ent:=GetData(AEntity);
  char:=TLDActor(AEntity).Character;

  state:=TFarmerState(ent.get('state'));

  case state of
    fsFarming:
      begin
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
  GuardBehavior:=TGuardBehavior(RegisterComponent('guard', TGuardBehavior));
  KingBehavior:=TKingBehavior(RegisterComponent('king', TKingBehavior));
  PlayerBehavior:=TPlayerBehavior(RegisterComponent('player', TPlayerBehavior));

end.

