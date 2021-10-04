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
    fKey: String;
    fIndex: longint;
    fSystem: TECSystem;
    fComponentData: array of TComponentData;
    function GetData(AComponent: longint): TComponentData;
    function GetKey: string;
  protected
    Components: TJSArray;
    property Data[AComponent: longint]: TComponentData read GetData;
  public
    constructor Create(ASystem: TECSystem);
    destructor Destroy; override;

    procedure AddComponent(AComponent: TECComponent);
    procedure RemoveComponent(AComponent: TECComponent);

    function HasComponent(AComponent: TECComponent): boolean;

    property Key: string read GetKey;
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
    fEntities: TJSArray;
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

    property Component[const AName: string]: TECComponent read GetComponent;
  end;

var
  EntitySystem: TECSystem;

implementation

var
  idxCtr: integer;

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
  result:=true;
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

function TECEntity.GetKey: string;
begin
  result:=fKey;
end;

constructor TECEntity.Create(ASystem: TECSystem);
begin
  inherited Create;
  fKey:=inttostr(idxCtr);
  inc(idxCtr);
  Components:=TJSArray.new;
  fSystem:=ASystem;
  fSystem.AddEntity(self);
end;

destructor TECEntity.Destroy;
var
  comp: JSValue;
begin
  for comp in Components do
    TECComponent(Comp).DeInit(self);
  fSystem.RemoveEntity(self);
  inherited Destroy;
end;

procedure TECEntity.AddComponent(AComponent: TECComponent);
begin
  if Components.indexOf(AComponent)<=-1 then
  begin
    fComponentData[AComponent.Index]:=TJSMap.new;
    Components.push(AComponent);

    AComponent.Init(self);
  end;
end;

procedure TECEntity.RemoveComponent(AComponent: TECComponent);
var
  idx: NativeInt;
begin
  idx:=Components.indexOf(AComponent);
  if idx>-1 then
  begin
    Components.splice(idx,1);

    AComponent.DeInit(self);
  end;
end;

function TECEntity.HasComponent(AComponent: TECComponent): boolean;
begin
  result:=Components.indexOf(AComponent)>-1;
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
  el, beh: JSValue;
begin                    
  fDelta:=ATimeMS-fLastTime;
  fLastTime:=ATimeMS;
  if fFirst then
    fDelta:=0;
  fFirst:=false;

  for el in fEntities do
    for beh in TECEntity(el).Components do
      TECComponent(beh).Update(TECEntity(el), fDelta, ATimeMS);

  inherited Update(AGame, ATimeMS);
end;

constructor TECSystem.Create;
begin
  inherited Create;
  fFirst:=true;

  fComponents:=TObjectList.Create(true);

  fEntities:=TJSArray.new();
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
end;

procedure TECSystem.AddEntity(AEntity: TECEntity);
begin
  fEntities.push(AEntity);
end;

procedure TECSystem.RemoveEntity(AEntity: TECEntity);
var
  idx: NativeInt;
begin                 
   idx:=fEntities.indexOf(AEntity);
   if idx>-1 then
     fEntities.splice(idx,1);
end;

initialization
  EntitySystem:=TECSystem.Create;

end.

