unit ECS;

{$mode ObjFPC}

interface

uses
  GameBase,
  JS,
  Classes, SysUtils,
  contnrs;

type
  TECComponent = class;
  TECSystem = class;

  TComponentData = TJSMap;

  TECEntity = class
  private
    fIndex: longint;
    fSystem: TECSystem;
    fComponentData: array of TComponentData;
    function GetData(AComponent: longint): TComponentData;
  protected
    procedure AllocateData(AComponent: longint);
    property Index: longint read fIndex write fIndex;

    property Data[AComponent: longint]: TComponentData read GetData;
  public
    constructor Create(ASystem: TECSystem);
    destructor Destroy; override;

    procedure AddComponent(AComponent: TECComponent);
    procedure RemoveComponent(AComponent: TECComponent);

    function HasComponent(AComponent: TECComponent): boolean;
  end;

  TECComponent = class       
  private
    fIndex: longint;
  protected
    function GetName: string; virtual;
    function GetData(AEntity: TECEntity): TJSMap;

    function HasData: boolean; virtual;

    procedure Init(AEntity{%H-}: TECEntity); virtual;
    procedure DeInit(AEntity{%H-}: TECEntity); virtual;
    procedure Update(AEntity{%H-}: TECEntity; ADeltaMS{%H-}, ATimeMS{%H-}: double); virtual;

    property Index: longint read fIndex write fIndex;
    property Name: string read GetName;
  public
  end;

  TECComponentClass = class of TECComponent;

  TBooleanArray = array of boolean;

  TECSystem = class(TGameElement)
  private                    
    fComponents: TObjectList;
    fEntities: array of TECEntity;
    fComponentUsed: array of TBooleanArray;
    fEntityCount: longint;

    function AllocEntity: longint;
    procedure FreeEntity(AIndex: longint);
  private
    fFirst: boolean;
    fDelta, fLastTime: Double;
    function GetComponent(const AName: string): TECComponent;
  protected
    procedure Update(AGame: TGameBase; ATimeMS: double); override;
  public
    constructor Create;
    destructor Destroy; override;

    function RegisterComponent(AComponentType: TECComponentClass): TECComponent;

    procedure AddEntity(AEntity: TECEntity);
    procedure RemoveEntity(AEntity: TECEntity);

    procedure AddComponent(AEntity: TECEntity; AComponent: TECComponent);
    procedure RemoveComponent(AEntity: TECEntity; AComponent: TECComponent);
    function  HasComponent(AEntity: TECEntity; AComponent: TECComponent): boolean;

    property Component[const AName: string]: TECComponent read GetComponent;
  end;

var
  EntitySystem: TECSystem;

implementation

function TECComponent.GetName: string;
begin
  result:=''
end;

function TECComponent.GetData(AEntity: TECEntity): TJSMap;
begin
  result:=AEntity.Data[Index];
end;

function TECComponent.HasData: boolean;
begin
  result:=false;
end;

procedure TECComponent.Init(AEntity: TECEntity);
begin
end;

procedure TECComponent.DeInit(AEntity: TECEntity);
begin
end;

procedure TECComponent.Update(AEntity: TECEntity; ADeltaMS, ATimeMS: double);
begin
end;

function TECEntity.GetData(AComponent: longint): TComponentData;
begin
  result:=fComponentData[AComponent];
end;

procedure TECEntity.AllocateData(AComponent: longint);
begin
  if AComponent>high(fComponentData) then
    setlength(fComponentData, AComponent+1);

  if fComponentData[AComponent] = nil then
    fComponentData[AComponent]:=TJSMap.new;
end;

constructor TECEntity.Create(ASystem: TECSystem);
begin
  inherited Create;
  fSystem:=ASystem;
  fSystem.AddEntity(self);
end;

destructor TECEntity.Destroy;
begin
  fSystem.RemoveEntity(self);
  inherited Destroy;
end;

procedure TECEntity.AddComponent(AComponent: TECComponent);
begin
  fSystem.AddComponent(self, AComponent);
end;

procedure TECEntity.RemoveComponent(AComponent: TECComponent);
begin
  fSystem.RemoveComponent(self, AComponent);
end;

function TECEntity.HasComponent(AComponent: TECComponent): boolean;
begin
  result:=fSystem.HasComponent(self, AComponent);
end;

function TECSystem.AllocEntity: longint;
var
  i, l: SizeInt;
begin
  if fEntityCount=0 then
    result:=0
  else if fEntityCount>=Length(fEntities) then
  begin
    l:=length(fEntities)*4 div 3;

    setlength(fEntities, l);
    for i:=0 to high(fComponentUsed) do
      setlength(fComponentUsed[i], l);
  end;

  for i:=0 to high(fComponentUsed) do
    fComponentUsed[i][fEntityCount]:=false;

  result:=fEntityCount;
  inc(fEntityCount);
end;

procedure TECSystem.FreeEntity(AIndex: longint);
var
  i: sizeint;
begin
  Dec(fEntityCount);

  if fEntityCount>0 then
  begin
    fEntities[AIndex]:=fEntities[fEntityCount];
    for i:=0 to high(fComponentUsed) do
      fComponentUsed[i][AIndex]:=fComponentUsed[i][fEntityCount];
  end;
end;

function TECSystem.GetComponent(const AName: string): TECComponent;
var
  i: Integer;
begin
  result:=nil;

  for i:=0 to fComponents.Count-1 do
    if TECComponent(fComponents[i]).Name=AName then
      exit(TECComponent(fComponents[i]));
end;

procedure TECSystem.Update(AGame: TGameBase; ATimeMS: double);
var
  i, i2: longint;
  e: TECEntity;
begin                    
  fDelta:=ATimeMS-fLastTime;
  fLastTime:=ATimeMS;
  if fFirst then
    fDelta:=0;
  fFirst:=false;

  for i:=0 to fEntityCount-1 do
  begin
    e:=fEntities[i];

    for i2:=0 to high(fComponentUsed) do
      if fComponentUsed[i2][i] then
        TECComponent(fComponents[i2]).Update(e, fDelta, ATimeMS);
  end;

  inherited Update(AGame, ATimeMS);
end;

constructor TECSystem.Create;
begin
  inherited Create;
  fFirst:=true;

  fComponents:=TObjectList.Create(true);

  setlength(fEntities, 16);
  fEntityCount:=0;
end;

destructor TECSystem.Destroy;
begin
  fComponents.Free;
  inherited Destroy;
end;

function TECSystem.RegisterComponent(AComponentType: TECComponentClass): TECComponent;
begin
  result:=AComponentType.Create;
  result.Index:=fComponents.Count;

  fComponents.Add(result);

  setlength(fComponentUsed, fComponents.Count);
  setlength(fComponentUsed[high(fComponentUsed)], length(fEntities));
end;

procedure TECSystem.AddEntity(AEntity: TECEntity);
var
  idx: LongInt;
begin
  idx:=AllocEntity;
  AEntity.Index:=idx;

  fEntities[idx]:=AEntity;
end;

procedure TECSystem.RemoveEntity(AEntity: TECEntity);
begin
  FreeEntity(AEntity.Index);
end;

procedure TECSystem.AddComponent(AEntity: TECEntity; AComponent: TECComponent);
var
  ds: SizeInt;
begin
  if fComponentUsed[AComponent.Index][AEntity.Index] then
    exit;

  fComponentUsed[AComponent.Index][AEntity.Index]:=true;

  if AComponent.HasData then
    AEntity.AllocateData(AComponent.Index);
  AComponent.Init(AEntity);
end;

procedure TECSystem.RemoveComponent(AEntity: TECEntity; AComponent: TECComponent);
begin        
  if not fComponentUsed[AComponent.Index][AEntity.Index] then
    exit;

  AComponent.DeInit(AEntity);
  fComponentUsed[AComponent.Index][AEntity.Index]:=false;
end;

function TECSystem.HasComponent(AEntity: TECEntity; AComponent: TECComponent): boolean;
begin
  result:=fComponentUsed[AComponent.Index][AEntity.Index];
end;

initialization
  EntitySystem:=TECSystem.Create;

end.

