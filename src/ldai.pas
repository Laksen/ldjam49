unit ldai;

{$mode ObjFPC}

interface

uses
  ldactor, ldconfig,
  ECS,
  GameMath,
  Classes, SysUtils, JS;

type
  TNPCState = (npcDead, npcAttacking, npcAttackMove, npcIdle);
  TIdlingState = (isRumaging);

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

  THomeTileBehavior = class(TNPCBehavior)
  private const
    UpdateInterval = 5;
  protected
    procedure Init(AEntity: TECEntity); override;

    procedure Update(AEntity: TECEntity; ADeltaMS, ATimeMS: double); override;
  public
    procedure SetHomeTile(AEntity: TECEntity; ASector, AX,AY: longint);
  end;

  TFarmerBehavior = class(THomeTileBehavior)
  end;

  TPlayerBehavior = class(TECComponent)
  end;

  TGuardBehavior = class(THomeTileBehavior)
  end;

  TKingBehavior = class(THomeTileBehavior)
  end;

var
  FarmerBehavior: THomeTileBehavior;
  GuardBehavior:  TGuardBehavior;
  KingBehavior:   TKingBehavior;

  PlayerBehavior: TPlayerBehavior;

implementation

uses
  GameBase, ldsounds;

procedure TNPCBehavior.DoAttack(AEntity, ATarget: TLDActor);
var
  diff: TPVector;
  data: TJSMap;
  dist: Double;
begin
  data:=GetData(AEntity);

  diff:=ATarget.Character.Position.sub(AEntity.Character.Position);
  dist:=diff.LengthSqr;

  if dist<100 then
    AEntity.Character.TriggerAttack
  else
    AEntity.Character.Target:=ATarget.Character.Position;
end;

function TNPCBehavior.Distance(AEntity, ATarget: TLDActor): double;
begin
  result:=ATarget.Character.Position.sub(AEntity.Character.Position).Length;
end;

function TNPCBehavior.Annoyance(AEntity, ATarget: TLDActor): double;
var
  ann: TJSMap;
begin
  result:=0;

  ann:=TJSMap(GetData(AEntity).get('annoyances'));
  if ann.has(ATarget.Key) then
    result:=double(ann.get(ATarget.Key));
end;

function TNPCBehavior.WantsToAttack(AEntity, ATarget: TLDActor): boolean;
begin
  result:=false;

  if AEntity=ATarget then exit(false);
  if AEntity.Character.Sector<>ATarget.Character.Sector then exit(false);
  if not atarget.Character.Alive then exit(false);

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

procedure THomeTileBehavior.Init(AEntity: TECEntity);
var
  ent: TJSMap;
begin
  inherited Init(AEntity);
  ent:=GetData(AEntity);

  ent.&set('home-state', isRumaging);
  ent.&set('home-sector', 0);
  ent.&set('home-x', 0);
  ent.&set('home-y', 0);
  ent.&set('last-update', -100000.0);
end;

procedure THomeTileBehavior.Update(AEntity: TECEntity; ADeltaMS, ATimeMS: double);
var
  ent: TJSMap;
  last_update, x, y: Double;
  char: TLDCharacter;
  newCoord: TPVector;
  state: TIdlingState;
  npcState: TNPCState;
begin
  ent:=GetData(AEntity);
  char:=TLDActor(AEntity).Character;

  inherited Update(AEntity, ADeltaMS, ATimeMS);

  npcState:=TNPCState(ent.get('state'));

  if npcState=npcIdle then
  begin
    state:=TIdlingState(ent.get('home-state'));

    case state of
      isRumaging:
        begin
          last_update:=double(ent.get('last-update'));
          if (ATimeMS-last_update)>(UpdateInterval*1000) then
          begin
            x:=double(ent.get('home-x'));
            y:=double(ent.get('home-y'));

            newCoord:=TPVector.New((x+random)*Config.SectorSize*0.99+0.01, (y+random)*Config.SectorSize*0.99+0.01);
            char.Target:=newCoord;

            if char.Visible and (self is TFarmerBehavior) then
              Game.Audio.Play(GetSound('rake'), 0.3);

            ent.&set('last-update', ATimeMS-1000*random);
          end;
        end;
    end;
  end;
end;

procedure THomeTileBehavior.SetHomeTile(AEntity: TECEntity; ASector, AX, AY: longint);
var
  ent: TJSMap;
begin
  ent:=GetData(AEntity);

  ent.&set('home-sector', ASector);
  ent.&set('home-x', ax);
  ent.&set('home-y', ay);
end;

initialization
  FarmerBehavior:=THomeTileBehavior(RegisterComponent('farmer', THomeTileBehavior));
  GuardBehavior:=TGuardBehavior(RegisterComponent('guard', TGuardBehavior));
  KingBehavior:=TKingBehavior(RegisterComponent('king', TKingBehavior));
  PlayerBehavior:=TPlayerBehavior(RegisterComponent('player', TPlayerBehavior));

end.

