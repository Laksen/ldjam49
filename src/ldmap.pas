unit ldmap;

{$mode ObjFPC}

interface

uses
  JS, webgl,
  ECS, resources,
  GameBase, GameSprite, GameMath,
  Classes, SysUtils;

const
  SectorTiles = 3;

  SectorSize = 150;

  GrowthTime = 10;

type
  TLDMapTileInfo = class
  private
    fAnimation: TGameAnimation;
    fBehaviors: TJSArray;
  public
    constructor Create(AInfo: TJSObject);

    property Animation: TGameAnimation read fAnimation;
    property Behaviors: TJSArray read fBehaviors;
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

  TLDSectorTileArray = array[0..SectorTiles-1] of array[0..SectorTiles-1] of TLDSectorTile;

  TLDSector = class
  private
    fID: integer;
    fTiles: TLDSectorTileArray;
  protected
    procedure Update(ATimeMS: double);
  public
    constructor Create(ASectorID: integer);

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

  TBarleyPlant = class(TGameElement)
  private
    fSize: longint;
    fLastTime,fTime,fTimeOffset: Double;
    fSprite: TGameSprite;
    function GetReady: boolean;
  protected
    procedure Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
    procedure Update(AGame: TGameBase; ATimeMS: double); override;
  public
    procedure Harvest;

    constructor Create(AX, AY: double; ASprite: TGameSprite);

    property Size: longint read fSize;
    property Ready: boolean read GetReady;
  end;

  TTileComponent = class(TECComponent)
  protected
    function GetName: string; override;

    function HasData: boolean; override;
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

    function HasData: boolean; override;
    function Sprite: TGameSprite; virtual;

    procedure Init(AEntity: TECEntity); override;
    procedure DeInit(AEntity: TECEntity); override;

    procedure Update(AEntity: TECEntity; ADeltaMS, ATimeMS: double); override;
  end;

  THops = class(TField)
  protected
    function GetName: string; override;
  end;

var
  Map: TLDMap;

procedure LoadTiles(const AInfo: string);

implementation

var
  TileInfo: TLDMapTiles;
  Behaviors: TJSMap;

var
  TileComp: TTileComponent;

procedure LoadTiles(const AInfo: string);
begin
  TileInfo:=TLDMapTiles.Create(AInfo);
end;

function TTileComponent.GetName: string;
begin
  result:='tile';
end;

function TTileComponent.HasData: boolean;
begin
  result:=true;
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
begin
  result[0]:=TPVector.new(X*SectorSize,     Y*SectorSize);
  result[1]:=TPVector.new((X+1)*SectorSize, Y*SectorSize);
  result[2]:=TPVector.new((X+1)*SectorSize, (Y+1)*SectorSize);
  result[3]:=TPVector.new(X*SectorSize,     (Y+1)*SectorSize);
end;

procedure TLDMap.Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport);
var
  i, i2: Integer;
  tile: TLDSectorTile;
begin
  inherited Render(GL, AViewport);

  if fCurrentSector=nil then exit;

  //writeln('r');

  for i:=0 to SectorTiles-1 do
    for i2:=0 to SectorTiles-1 do
    begin
      tile:=fCurrentSector.Tiles[i,i2];

      RenderFrame(GL, AViewport, MakeTileQuad(i,i2), tile.TileType.Animation.GetFrame(tile.Time));
    end;
end;

constructor TLDMap.Create;
begin
  inherited Create;
  fSectors:=TJSMap.new;
end;

function TLDMap.GetSector(AX, AY: longint): TLDSector;
var
  key: TJSArray;
begin
  key:=TJSArray.new(ax,ay);
  if not fSectors.has(key) then
    fSectors.&set(key, TLDSector.Create(0));

  result:=TLDSector(fSectors.get(key));
end;

procedure TLDMap.SetCurrentSector(ASector: TLDSector);
begin
  fCurrentSector:=ASector;
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
begin
  for i:=0 to SectorTiles-1 do
    for i2:=0 to SectorTiles-1 do
      fTiles[i][i2].Update(ATimeMS);
end;

constructor TLDSector.Create(ASectorID: integer);
var
  i, i2: Integer;
begin
  inherited Create;
  fID:=ASectorID;

  for i:=0 to SectorTiles-1 do
    for i2:=0 to SectorTiles-1 do
      fTiles[i][i2]:=TLDSectorTile.Create(EntitySystem, TileInfo['grass'], ASectorID, i,i2);
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
var
  texture: TGameTexture;
  tw, th, xcnt, ycnt: longint;
  y, x: Integer;
  interval: Double;
begin
  inherited Create;
  fBehaviors:=TJSArray(AInfo['behavior']);
  fAnimation:=TGameAnimation.Create('tile');

  interval:=double(AInfo['tile-interval']);
  tw:=integer(AInfo['tile-width']);
  th:=integer(AInfo['tile-height']);

  texture:=TResources.AddImage(string(AInfo['sprite']));
  xcnt:=texture.Width div tw;
  ycnt:=texture.height div th;

  for y:=0 to ycnt-1 do
    for x:=0 to xcnt-1 do
      fAnimation.AddFrame(texture, TPVector.New(tw*x, y*th),  TPVector.New(tw*x+tw-1, y*th+th-1), interval);
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

function THarvestable.GetName: string;
begin
  result:='harvestable';
end;

function TBarleyPlant.GetReady: boolean;
begin
  result:= Size>=3;
end;

procedure TBarleyPlant.Render(GL: TJSWebGLRenderingContext; const AViewport: TGameViewport);
var
  frame: TGameFrame;
begin
  frame:=fSprite.GetFrame('stage'+inttostr(fSize), fTime+fTimeOffset);

  RenderFrame(gl, AViewport, GetGrowthRect(Position, 40,40), frame);
end;

procedure TBarleyPlant.Update(AGame: TGameBase; ATimeMS: double);
begin
  if fSize<3 then
  begin
    if (ATimeMS-fLastTime)>1000*GrowthTime then
    begin
      fLastTime:=ATimeMS;
      inc(fSize);
    end;
  end
  else
    fLastTime:=ATimeMS;
  fTime:=ATimeMS / 1000;
end;

procedure TBarleyPlant.Harvest;
begin
  fTime:=fLastTime;
  fSize:=0;
end;

constructor TBarleyPlant.Create(AX, AY: double; ASprite: TGameSprite);
begin
  inherited Create;
  fTimeOffset:=Random;
  fSize:=0;
  Position:=TPVector.New(ax,ay);
  fSprite:=ASprite;
end;

function TField.GetName: string;
begin
  result:='field';
end;

function TField.HasData: boolean;
begin
  result:=true;
end;

function TField.Sprite: TGameSprite;
begin
  result:=GetSprite('barley');
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
    plants.push(TBarleyPlant.Create(x*SectorSize+random(SectorSize), y*SectorSize+random(SectorSize), Sprite));

  plants:=plants.sort(function (a,b : JSValue) : NativeInt
  begin
    result:=round(TBarleyPlant(b).Position.y - TBarleyPlant(a).Position.y);
  end);

  for el in plants do
    Game.AddElement(TGameElement(el));

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

initialization
  TileComp:=TTileComponent(EntitySystem.RegisterComponent(TTileComponent));

  Behaviors:=TJSMap.new;
  Behaviors.&set('harvestable', EntitySystem.RegisterComponent(THarvestable));
  Behaviors.&set('field', EntitySystem.RegisterComponent(TField));
  Behaviors.&set('hops', EntitySystem.RegisterComponent(THops));

  Map:=TLDMap.Create;

end.

