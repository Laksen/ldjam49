unit ldai;

{$mode ObjFPC}

interface

uses
  ldactor, ldconfig,
  ECS,
  GameMath,
  Classes, SysUtils, JS;

type
  TNPCState = (npcDead, npcAttacking, npcIdle);
  TFarmerState = (fsFarming);

  TNPCBehavior = class(TECComponent)
  private
    procedure DoAttack(AEntity, ATarget: TLDActor);
  protected
    function Distance(AEntity, ATarget: TLDActor): double;
    function Annoyance(AEntity, ATarget: TLDActor): double; virtual;
    function WantsToAttack(AEntity, ATarget: TLDActor): boolean; virtual;

    procedure Init(AEntity: TECEntity); override;
    procedure Update(AEntity: TECEntity; ADeltaMS, ATimeMS: double); override;
  public
    procedure AddAnnoyance(AEntity, ATarget: TLDActor; AAnnoyance: double);
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

procedure TNPCBehavior.DoAttack(AEntity, ATarget: TLDActor);
var
  diff: TPVector;
begin
  //writeln('Attack');

  diff:=ATarget.Character.Position.sub(AEntity.Character.Position);

  AEntity.Character.Target:=ATarget.Character.Position;
end;

function TNPCBehavior.Distance(AEntity, ATarget: TLDActor): double;
begin
  result:=0;
end;

function TNPCBehavior.Annoyance(AEntity, ATarget: TLDActor): double;
begin
  result:=10000;
end;

function TNPCBehavior.WantsToAttack(AEntity, ATarget: TLDActor): boolean;
begin
  result:=false;

  if AEntity=ATarget then exit(false);

  if ATarget.Character=Player then
    result:=(Annoyance(AEntity, ATarget)>=Config.PlayerAnnoyanceLevel) and (Distance(AEntity, ATarget)<Config.PlayerAttackRange)
  else if ATarget.Character=King then
    result:=Annoyance(AEntity, ATarget)>=Config.KingAnnoyanceLevel;
end;

procedure TNPCBehavior.Init(AEntity: TECEntity);
var
  data: TJSMap;
begin
  inherited Init(AEntity);
  data:=GetData(AEntity);
  data.&set('state', npcIdle);
  data.&set('annoyances', tjsmap.new);
end;

procedure TNPCBehavior.Update(AEntity: TECEntity; ADeltaMS, ATimeMS: double);
var
  data, annoyances: TJSMap;
  k: string;
  coolDown: Double;
begin
  inherited Update(AEntity, ADeltaMS, ATimeMS);

  data:=GetData(AEntity);

  coolDown:=config.AnnoyanceCooldown;

  annoyances:=tjsmap(data.get('annoyances'));
  for k in annoyances.keys do
    annoyances.&set(k, double(annoyances.get(k))*coolDown*ADeltaMS);

  // Handle basics
  if not TLDActor(AEntity).Character.Alive then
    data.&set('state', npcDead)
  else if WantsToAttack(TLDActor(AEntity), Player.Actor) then
  begin
    data.&set('state', npcAttacking);
    data.&set('target', Player);

    DoAttack(TLDActor(AEntity), Player.Actor);
  end
  else if WantsToAttack(TLDActor(AEntity), King.Actor) then
  begin
    data.&set('state', npcAttacking);
    data.&set('target', King);

    DoAttack(TLDActor(AEntity), King.Actor);
  end
  else
    data.&set('state', npcIdle);
end;

procedure TNPCBehavior.AddAnnoyance(AEntity, ATarget: TLDActor; AAnnoyance: double);
var
  data, annoyances: TJSMap;
  k: String;
begin
  data:=GetData(AEntity);
  annoyances:=tjsmap(data.get('annoyances'));

  k:=ATarget.Key;
  if annoyances.has(k) then
    annoyances.&set(k, double(annoyances.get(k)) + AAnnoyance)
  else
    annoyances.&set(k, AAnnoyance);
end;

procedure TFarmerBehavior.Init(AEntity: TECEntity);
var
  ent: TJSMap;
begin
  inherited Init(AEntity);
  ent:=GetData(AEntity);

  ent.&set('farm-state', fsFarming);
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
  npcState: TNPCState;
begin
  ent:=GetData(AEntity);
  char:=TLDActor(AEntity).Character;

  inherited Update(AEntity, ADeltaMS, ATimeMS);

  npcState:=TNPCState(ent.get('state'));

  if npcState=npcIdle then
  begin
    state:=TFarmerState(ent.get('farm-state'));

    case state of
      fsFarming:
        begin
          last_update:=double(ent.get('last-update'));
          if (ATimeMS-last_update)>(UpdateInterval*1000) then
          begin
            x:=double(ent.get('farm-x'));
            y:=double(ent.get('farm-y'));

            newCoord:=TPVector.New((x+random)*Config.SectorSize*0.99+0.01, (y+random)*Config.SectorSize*0.99+0.01);
            char.Target:=newCoord;

            ent.&set('last-update', ATimeMS-1000*random);
          end;
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

