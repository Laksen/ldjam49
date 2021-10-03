unit ldmap;

{$mode ObjFPC}

interface

uses
  JS, webgl,
  ECS, resources,
  ldconfig,
  GameBase, GameSprite, GameMath,
  Classes, SysUtils;

type
  TLDMapTileInfo = class
  private
    fAnimation: string;
    fSprite: TGameSprite;
    fBehaviors: TJSArray;
    fWalkable: boolean;
  public
    constructor Create(AInfo: TJSObject);

    property Animation: string read fAnimation;
    property Sprite: TGameSprite read fSprite;
    property Behaviors: TJSArray read fBehaviors;
    property Walkable: boolean read fWalkable;
  end;

  TLDMapTiles = class
  private
    fMap: TJSMap;
    function GetTile(const AName: string): TLDMapTileInfo;
  public
    constructor Create(const AInformation: string);

    property Tile[AName: string]: TLDMapTileInfo read GetTile; default;
  end;

  TLDSectorTile = class(TECEntity)
  private
    fTileType: TLDMapTileInfo;
    fTime: double;
  protected
    procedure Update(ATimeMS: double);
  public
    constructor Create(ASystem: TECSystem; ATileType: TLDMapTileInfo; ASector, AX, AY: integer);

    property Time: double read fTime;
    property TileType: TLDMapTileInfo read fTileType;
  end;

  TLDSectorTileArray = array of array of TLDSectorTile;

  TLDSector = class
  private
    fID: integer;
    fTiles: TLDSectorTileArray;
  protected
    procedure Update(ATimeMS: double);
  public
    constructor Create();

    procedure SetTile(AX,AY: longint; ATileType: TLDMapTileInfo);
    procedure SetTile(AX, AY: longint; const AName: string);

    property ID: integer read fID;
    property Tiles: TLDSectorTileArray read fTiles;
  end;

  TLDMap = class(TGameElement)
  private
    fCurrentSector: TLDSector;
    fSectors: TJSMap;
  protected
    procedure Update(AGame: TGameBase; ATimeMS: double); override;
    procedure Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
  public
    constructor Create;

    function GetSector(AX, AY: longint): TLDSector;
    procedure SetCurrentSector(ASector: TLDSector);

    property CurrentSector: TLDSector read fCurrentSector;
  end;

  TPlant = class(TGameElement)
  private
    fMax,
    fSize: longint;
    fLastTime,fTime,fTimeOffset: Double;
    fSprite: TGameSprite;
    function GetReady: boolean;
  protected
    procedure Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
    procedure Update(AGame: TGameBase; ATimeMS: double); override;
  public
    procedure Harvest;

    constructor Create(AX, AY: double; ASprite: TGameSprite; AMaxStage: longint);

    property Size: longint read fSize;
    property Ready: boolean read GetReady;
  end;

  TTileComponent = class(TECComponent)
  protected
    function GetName: string; override;
  public
    procedure SetInfo(ATile: TLDSectorTile; ASector, AX,AY: integer);
    procedure GetInfo(ATile: TLDSectorTile; var ASector, AX,AY: integer);
  end;

  THarvestable = class(TECComponent)
  protected
    function GetName: string; override;
  end;

  TField = class(TECComponent)
  protected
    function GetName: string; override;

    function Sprite: TGameSprite; virtual;
    function GetMax: integer; virtual;

    procedure Init(AEntity: TECEntity); override;
    procedure DeInit(AEntity: TECEntity); override;

    procedure Update(AEntity: TECEntity; ADeltaMS, ATimeMS: double); override;
  public
    procedure SetPlantsVisible(AEntity: TECEntity; AVisible: boolean);
  end;

  THops = class(TField)
  protected
    function GetName: string; override;

    function Sprite: TGameSprite; override;
    function GetMax: integer; override;
  end;

var
  Map: TLDMap;

procedure LoadTiles(const AInfo: string);

implementation

uses
  ldactor;

var
  Sectors: integer = 0;

  TileInfo: TLDMapTiles;
  Behaviors: TJSMap;

var
  FieldComp: TField;
  TileComp: TTileComponent;

procedure LoadTiles(const AInfo: string);
begin
  TileInfo:=TLDMapTiles.Create(AInfo);
end;

function TTileComponent.GetName: string;
begin
  result:='tile';
end;

procedure TTileComponent.SetInfo(ATile: TLDSectorTile; ASector, AX, AY: integer);
var
  data: TJSMap;
begin
  data:=GetData(ATile);
  data.&set('sector', ASector);
  data.&set('x', ax);
  data.&set('y', ay);
end;

procedure TTileComponent.GetInfo(ATile: TLDSectorTile; var ASector, AX, AY: integer);
var
  data: TJSMap;
begin
  data:=GetData(ATile);
  ASector:=integer(data.get('sector'));
  ax:=integer(data.get('x'));
  ay:=integer(data.get('y'));
end;

procedure TLDMap.Update(AGame: TGameBase; ATimeMS: double);
begin
  inherited Update(AGame, ATimeMS);

  fSectors.forEach(procedure(value, key: jsvalue) begin
    TLDSector(value).Update(ATimeMS);
  end);
end;

function MakeTileQuad(X,Y: longint): TGameQuad;
var
  SectorSize: LongInt;
begin
  SectorSize:=Config.SectorSize;

  result[0]:=TPVector.new(X*SectorSize,     (Y+1)*SectorSize);
  result[1]:=TPVector.new((X+1)*SectorSize, (Y+1)*SectorSize);
  result[2]:=TPVector.new((X+1)*SectorSize, Y*SectorSize);
  result[3]:=TPVector.new(X*SectorSize,     Y*SectorSize);
end;

procedure TLDMap.Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport);
var
  i, i2: Integer;
  tile: TLDSectorTile;
begin
  inherited Render(GL, AViewport);

  if fCurrentSector=nil then exit;

  //writeln('r');

  for i:=0 to Config.SectorTiles-1 do
    for i2:=0 to Config.SectorTiles-1 do
    begin
      tile:=fCurrentSector.Tiles[i,i2];

      RenderFrame(GL, AViewport, MakeTileQuad(i,i2), tile.TileType.Sprite.GetFrame(tile.TileType.Animation, tile.Time));
    end;
end;

constructor TLDMap.Create;
begin
  inherited Create(true);
  fSectors:=TJSMap.new;
end;

function TLDMap.GetSector(AX, AY: longint): TLDSector;
var
  key: string;
begin
  key:=inttostr(ax)+'x'+inttostr(ay);
  if not fSectors.has(key) then
    fSectors.&set(key, TLDSector.Create());

  result:=TLDSector(fSectors.get(key));
end;

procedure TLDMap.SetCurrentSector(ASector: TLDSector);
var
  i, i2: Integer;
  tile: TLDSectorTile;
  hops: THops;
  field: TField;
  sectorTiles: SizeInt;
begin
  hops:=THops(Behaviors.get('hops'));
  field:=TField(Behaviors.get('field'));

  if fCurrentSector<>nil then
  begin
    sectorTiles:=length(fCurrentSector.Tiles);

    // Hide stuff
    for i:=0 to SectorTiles-1 do
      for i2:=0 to SectorTiles-1 do
      begin
        tile:=fCurrentSector.Tiles[i][i2];

        if tile.HasComponent(hops) then  hops.SetPlantsVisible(tile, false);
        if tile.HasComponent(field) then field.SetPlantsVisible(tile, false);
      end;
  end;

  fCurrentSector:=ASector;

  // Show stuff       
  sectorTiles:=length(fCurrentSector.Tiles);

  for i:=0 to SectorTiles-1 do
    for i2:=0 to SectorTiles-1 do
    begin
      tile:=fCurrentSector.Tiles[i][i2];

      if tile.HasComponent(hops) then  hops.SetPlantsVisible(tile, true);
      if tile.HasComponent(field) then field.SetPlantsVisible(tile, true);
    end;

  ShowCharacters(fCurrentSector.ID);
end;

procedure TLDSectorTile.Update(ATimeMS: double);
begin
  fTime:=ATimeMS;
end;

constructor TLDSectorTile.Create(ASystem: TECSystem; ATileType: TLDMapTileInfo; ASector,AX,AY: integer);
var
  beh: JSValue;
begin
  inherited Create(ASystem);
  fTileType:=ATileType;

  AddComponent(TileComp);
  TileComp.SetInfo(self, ASector,AX,AY);

  for beh in ATileType.Behaviors do
    AddComponent(TECComponent(Behaviors.get(beh)));
end;

procedure TLDSector.Update(ATimeMS: double);
var
  i, i2: Integer;
  sectorTiles: SizeInt;
begin
  sectorTiles:=length(fTiles);
  for i:=0 to SectorTiles-1 do
    for i2:=0 to SectorTiles-1 do
      fTiles[i][i2].Update(ATimeMS);
end;

constructor TLDSector.Create();
var
  i, i2: Integer;
  sectorTiles: LongInt;
begin
  inherited Create;
  fID:=Sectors;
  inc(Sectors);

  sectorTiles:=Config.SectorTiles;

  setlength(fTiles,sectorTiles,sectorTiles);
  for i:=0 to SectorTiles-1 do
    for i2:=0 to SectorTiles-1 do
      fTiles[i][i2]:=TLDSectorTile.Create(EntitySystem, TileInfo['grass'], fID, i,i2);
end;

procedure TLDSector.SetTile(AX, AY: longint; ATileType: TLDMapTileInfo);
begin
  fTiles[AX][AY].Free;
  fTiles[AX][AY]:=TLDSectorTile.Create(EntitySystem, ATileType, id,AX,ay);
end;

procedure TLDSector.SetTile(AX, AY: longint; const AName: string);
begin
  SetTile(AX,AY, TileInfo[AName]);
end;

constructor TLDMapTileInfo.Create(AInfo: TJSObject);
begin
  inherited Create;
  fBehaviors:=TJSArray(AInfo['behavior']);

  fSprite:=GetSprite(string(AInfo['sprite']));
  fAnimation:=string(AInfo['animation']);
end;

function TLDMapTiles.GetTile(const AName: string): TLDMapTileInfo;
begin
  result:=TLDMapTileInfo(fMap.get(aname));
end;

constructor TLDMapTiles.Create(const AInformation: string);
var
  fInfo: TJSObject;
  el: string;
begin
  fInfo:=TJSObject(TJSJSON.parse(AInformation));
  fMap:=TJSMap.new;

  for el in TJSObject.keys(TJSObject(fInfo['tiles'])) do
    fMap.&set(el, TLDMapTileInfo.Create(TJSObject(TJSObject(fInfo['tiles'])[el])));
end;

function GetGrowthRect(ACenter: TPVector; AWidth, AHeight: double): TGameQuad;
begin
  result[0]:=ACenter.Add(TPVector.new(-AWidth/2, 0, AHeight));
  result[1]:=ACenter.Add(TPVector.new( AWidth/2, 0, AHeight));
  result[2]:=ACenter.Add(TPVector.new( AWidth/2, 0, 0));
  result[3]:=ACenter.Add(TPVector.new(-AWidth/2, 0, 0));
end;

function THops.GetName: string;
begin
  result:='hops';
end;

function THops.Sprite: TGameSprite;
begin
  result:=GetSprite('hops');
end;

function THops.GetMax: integer;
begin
  Result:=5;
end;

function THarvestable.GetName: string;
begin
  result:='harvestable';
end;

function TPlant.GetReady: boolean;
begin
  result:= Size>=fMax;
end;

procedure TPlant.Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport);
var
  frame: TGameFrame;
begin
  frame:=fSprite.GetFrame('stage'+inttostr(fSize), fTime+fTimeOffset);

  RenderFrame(gl, AViewport, GetGrowthRect(Position, 40,40), frame);
end;

procedure TPlant.Update(AGame: TGameBase; ATimeMS: double);
begin
  if fSize<fMax then
  begin
    if (ATimeMS-fLastTime)>1000*Config.GrowthTime then
    begin
      fLastTime:=ATimeMS;
      inc(fSize);
    end;
  end
  else
    fLastTime:=ATimeMS;
  fTime:=ATimeMS / 1000;
end;

procedure TPlant.Harvest;
begin
  fTime:=fLastTime;
  fSize:=0;
end;

constructor TPlant.Create(AX, AY: double; ASprite: TGameSprite; AMaxStage: longint);
begin
  inherited Create;
  fMax:=AMaxStage;
  fTimeOffset:=Random;
  fSize:=0;
  Position:=TPVector.New(ax,ay);
  fSprite:=ASprite;
end;

function TField.GetName: string;
begin
  result:='field';
end;

function TField.Sprite: TGameSprite;
begin
  result:=GetSprite('barley');
end;

function TField.GetMax: integer;
begin
  result:=3;
end;

procedure TField.Init(AEntity: TECEntity);
var
  plants: TJSArray;
  el: JSValue;
  i, sec, y, x: Integer;
begin
  inherited Init(AEntity);

  plants:=TJSArray.new;

  TileComp.GetInfo(TLDSectorTile(AEntity), sec, x, y);

  for i:=0 to 19 do
    plants.push(TPlant.Create((x+random)*Config.SectorSize, (y+random)*Config.SectorSize, Sprite, GetMax));

  for el in plants do
    Game.AddElement(TGameElement(el)).Visible:=false;

  GetData(AEntity).&set('plants', plants);
end;

procedure TField.DeInit(AEntity: TECEntity);
var
  plants: TJSArray;
  el: JSValue;
begin
  inherited DeInit(AEntity);
  plants:=TJSArray(GetData(AEntity).get('plants'));

  for el in plants do
    Game.RemoveElement(TGameElement(el), true);
end;

procedure TField.Update(AEntity: TECEntity; ADeltaMS, ATimeMS: double);
begin
  inherited Update(AEntity, ADeltaMS, ATimeMS);
  //writeln('Grow! ', GetData(AEntity).get('plants'));
end;

procedure TField.SetPlantsVisible(AEntity: TECEntity; AVisible: boolean);
var
  el: JSValue;
  plants: TJSArray;
begin
  plants:=TJSArray(GetData(AEntity).get('plants'));

  writeln('Setting stuff ', AVisible);

  for el in plants do
    TGameElement(el).Visible:=AVisible;
end;

initialization
  TileComp:=TTileComponent(EntitySystem.RegisterComponent(TTileComponent));

  Behaviors:=TJSMap.new;
  Behaviors.&set('harvestable', EntitySystem.RegisterComponent(THarvestable));
  Behaviors.&set('field', EntitySystem.RegisterComponent(TField));
  Behaviors.&set('hops', EntitySystem.RegisterComponent(THops));

  Map:=TLDMap.Create;

end.

