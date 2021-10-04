unit ldconfig;

{$mode ObjFPC}

interface

uses
  JS,
  Classes, SysUtils;

type
  TConfig = record
    SectorTiles,
    SectorSize,
    GrowthTime: longint;

    PlayerAnnoyanceLevel,
    PlayerAttackRange,
    KingAnnoyanceLevel,

    DamageRange,

    DamageAnnoyanceRatio,

    AnnoyanceCooldown: double;

    Characters: TJSMap;
  end;

var
  Config: TConfig;

procedure LoadConfig(const AInfo: string);

implementation

function TryGet(AObj: TJSObject; const AKey: String; ADefault: Integer): integer;
begin
  if AObj.hasOwnProperty(AKey) then
    result:=integer(AObj[akey])
  else
    result:=ADefault;
end;

function TryGetDouble(AObj: TJSObject; const AKey: String; ADefault: double): double;
begin
  if AObj.hasOwnProperty(AKey) then
    result:=double(AObj[akey])
  else
    result:=ADefault;
end;

procedure LoadConfig(const AInfo: string);
var
  fInfo, obj: TJSObject;
  key: String;
begin
  fInfo:=TJSObject(TJSJSON.parse(AInfo));

  Config.SectorTiles:=TryGet(fInfo,'SectorTiles',3);
  Config.SectorSize:=TryGet(fInfo,'SectorSize',150);
  Config.GrowthTime:=TryGet(fInfo,'GrowthTime',10);

  Config.PlayerAnnoyanceLevel:=TryGetDouble(fInfo,'PlayerAnnoyanceLevel',2);
  Config.PlayerAttackRange:=TryGetDouble(fInfo,'PlayerAttackRange',200);
  Config.KingAnnoyanceLevel:=TryGetDouble(fInfo,'KingAnnoyanceLevel',10);
  Config.DamageRange:=TryGetDouble(fInfo,'DamageRange',200);
  config.DamageAnnoyanceRatio:=TryGetDouble(fInfo,'DamageAnnoyanceRatio',1);
  Config.AnnoyanceCooldown:=TryGetDouble(fInfo,'AnnoyanceCooldown',0.9);

  Config.Characters:=TJSMap.new;

  obj:=TJSObject(fInfo['Characters']);
  for key in TJSObject.keys(obj) do
    config.Characters.&set(key, obj[key]);
end;

end.

