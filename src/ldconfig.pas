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

procedure LoadConfig(const AInfo: string);
var
  fInfo, obj: TJSObject;
  key: String;
begin
  fInfo:=TJSObject(TJSJSON.parse(AInfo));

  Config.SectorTiles:=TryGet(fInfo,'SectorTiles',3);
  Config.SectorSize:=TryGet(fInfo,'SectorSize',150);
  Config.GrowthTime:=TryGet(fInfo,'GrowthTime',10);

  Config.Characters:=TJSMap.new;

  obj:=TJSObject(fInfo['Characters']);
  for key in TJSObject.keys(obj) do
    config.Characters.&set(key, obj[key]);
end;

end.

