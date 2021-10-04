unit resources;

{$mode objfpc}

interface

uses
  Classes, Sysutils, Web, JS,
  GameBase;

type
  TResourceString = class
  private
    fString: string;
  protected
    procedure SetText(const AText: string);
  public
    property Text: string read fString;
  end;

  TResources = class
  private
    class function Loaded(Event: TEventListenerEvent): boolean;
  public
    class function AddString(const ASrc: string): TResourceString;
    class function AddImage(const ASrc: string): TGameTexture;
    class function AddSound(const ASrc: string): TJSHTMLAudioElement;

    class function Completed: boolean;
    class function Total: longint;
    class function TotalLoaded: longint;
  end;

implementation

type
  TResourceTexture = class(TGameTexture)
  protected
    constructor Create(AWidth, AHeight: longint); override;

    procedure LoadNew(AData: TJSHTMLImageElement);
  end;

  TResource = class
  private
    fTargetObj, fObj: JSValue;
    fSrc: string;
  public
    constructor Create(const ASrc: string; AObj, ATargetObj: JSValue);
    destructor Destroy; override;

    property Src: string read fSrc;
    property Obj: JSValue read fObj;
    property TargetObj: JSValue read fTargetObj;
  end;

var
  LoadedCount: longint = 0;
  Resources: TList;

procedure TResourceString.SetText(const AText: string);
begin
  fString:=AText;
end;

constructor TResourceTexture.Create(AWidth, AHeight: longint);
begin
  inherited Create(AWidth, AHeight);
end;

procedure TResourceTexture.LoadNew(AData: TJSHTMLImageElement);
begin

end;

constructor TResource.Create(const ASrc: string; AObj, ATargetObj: JSValue);
begin
  inherited Create;
  fSrc:=ASrc;
  fObj:=AObj;
  fTargetObj:=ATargetObj;
end;

destructor TResource.Destroy;
begin
  fObj:=nil;
  inherited Destroy;
end;

class function TResources.Loaded(Event: TEventListenerEvent): boolean;
var
  source: string;
  el: JSValue;
begin
  source:='<unknown resource>';
  if Event.target is TJSHTMLImageElement then
  begin
    source:=TJSHTMLImageElement(event.target).src;

    for el in Resources do
      if TResource(el).Obj=event.target then
        TResourceTexture(TResource(el).TargetObj).Load(TJSHTMLImageElement(event.target));
  end;

  //console.log('Loaded '+source);

  inc(LoadedCount);
  result:=true;
end;

function GetText(ABlob: TJSBlob): string; async; assembler;
asm
  return await ABlob.text();
end;

procedure FetchBlob(ASrc: string; ADest: JSValue); async;
var
  response: TJSResponse;
  myBlob: TJSBlob;
  s: String;
begin
  try
    response:=await(window.fetch(ASrc));

    if not response.ok then
      raise Exception.Create('HTTP error! status: '+str(response.status))
    else begin
      myBlob := await(response.blob());

      if ADest is TResourceString then
      begin
        s:=Await(GetText(myBlob));
        TResourceString(ADest).SetText(s);

        inc(LoadedCount);
      end;
      {objectURL := TJSURL.createObjectURL(myBlob);
      image := TJSHTMLImageElement(document.createElement('img'));
      image.src := objectURL;
      document.body.appendChild(image);}

      //console.Log('Loaded '+ASrc);
    end;
  except
    console.log(JSExceptValue);
  end;
end;

class function TResources.AddString(const ASrc: string): TResourceString;
var
  res: JSValue;
begin
  for res in Resources do
    if TResource(res).Src=ASrc then
      exit(TResourceString(TResource(res).TargetObj));

  result:=TResourceString.Create;

  FetchBlob(ASrc, result);

  Resources.Add(TResource.Create(ASrc, result, result));
end;

class function TResources.AddImage(const ASrc: string): TGameTexture;
var
  res: JSValue;
  img: TJSHTMLImageElement;
begin
  for res in Resources do
    if TResource(res).Src=ASrc then
      exit(TGameTexture(TResource(res).TargetObj));

  img:=document.createElement('img') as TJSHTMLImageElement;
  img.onload:=@Loaded;
  img.src:=ASrc;

  result:=TResourceTexture.Create(1,1);

  Resources.Add(TResource.Create(ASrc, img, result));
end;

class function TResources.AddSound(const ASrc: string): TJSHTMLAudioElement;
var
  res: JSValue;
begin
  for res in Resources do
    if TResource(res).Src=ASrc then
      exit(TJSHTMLAudioElement(TResource(res).TargetObj));

  result:=document.createElement('audio') as TJSHTMLAudioElement;
  result.preload:='auto';
  result.addEventListener('canplaythrough', @Loaded);
  result.src:=ASrc;

  Resources.Add(TResource.Create(ASrc, result, result));
end;

class function TResources.Completed: boolean;
begin
  result:=TotalLoaded>=Total;
end;

class function TResources.Total: longint;
begin
  result:=Resources.Count;
end;

class function TResources.TotalLoaded: longint;
begin
  result:=LoadedCount;
end;

initialization
  Resources:=TList.Create;

end.

