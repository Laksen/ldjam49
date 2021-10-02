unit ECS;

{$mode ObjFPC}

interface

uses
  GameBase,
  Classes, SysUtils,
  contnrs;

type
  TECComponent = class;
  TECSystem = class;

  TBytes = array of byte;

  TECEntity = class
  private
    fIndex: longint;
    fSystem: TECSystem;
    fComponentData: array of TBytes;
    function GetData(AComponent: longint): TBytes;
  protected
    procedure AllocateData(AComponent: longint; ASize: SizeInt);
    property Index: longint read fIndex write fIndex;

    property Data[AComponent: longint]: TBytes read GetData;
  public
    constructor Create(ASystem: TECSystem);

    procedure AddComponent(AComponent: TECComponent);
    procedure RemoveComponent(AComponent: TECComponent);

    function HasComponent(AComponent: TECComponent): boolean;
  end;

  TECComponent = class       
  private
    fIndex: longint;
  protected
    function DataSize: sizeint; virtual;

    procedure Init(AEntity{%H-}: TECEntity); virtual;
    procedure DeInit(AEntity{%H-}: TECEntity); virtual;
    procedure Update(AEntity{%H-}: TECEntity; ADeltaMS{%H-}, ATimeMS{%H-}: double); virtual;

    property Index: longint read fIndex write fIndex;
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
  end;

implementation

function TECComponent.DataSize: sizeint;
begin
  result:=0;
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

function TECEntity.GetData(AComponent: longint): TBytes;
begin
  result:=fComponentData[AComponent];
end;

procedure TECEntity.AllocateData(AComponent: longint; ASize: SizeInt);
begin
  if AComponent>high(fComponentData) then
    setlength(fComponentData, AComponent+1);

  if Length(fComponentData[AComponent])<>ASize then
    SetLength(fComponentData[AComponent], ASize);
end;

constructor TECEntity.Create(ASystem: TECSystem);
begin
  inherited Create;
  fSystem:=ASystem;
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
      fComponentUsed[AIndex]:=fComponentUsed[fEntityCount];
  end;
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

  ds:=AComponent.DataSize;
  if ds>0 then
    AEntity.AllocateData(AComponent.Index, ds); 
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

end.

