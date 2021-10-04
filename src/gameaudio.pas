unit gameaudio;

{$mode ObjFPC}

interface

uses
  web, webaudio,
  Classes;

type
  TGameAudioPlayState = (psNormal, psFadeout, psDone);

  TGameAudioSource = class;

  TGameAudioEnded = procedure(ASrc: TGameAudioSource) of object;

  TGameAudioSource = class
  private
    fFadeStart,
    fFadeTime: double;
    fLooping: Boolean;
    fAudio: TJSHTMLAudioElement;
    fOnEnd: TGameAudioEnded;
    fState: TGameAudioPlayState;
    fVolume: double;
  public
    constructor Create(ASource: TJSHTMLAudioElement; AVolume: double; ALooping: boolean=false);
    destructor Destroy; override;

    procedure FadeOut(AStartTime, ATime: double);
    procedure Update(ATime: double);

    property Volume: double read fVolume write fVolume;
    property State: TGameAudioPlayState read fState;
    property OnEnd: TGameAudioEnded read fOnEnd write fOnEnd;
  end;

  TGameAudio = class
  private
    fSources: TList;
    fAudioCtx: TJSAudioContext;
  public
    constructor Create;

    function Play(ASource: TJSHTMLAudioElement; AVolume: double; ALooping: boolean=false): TGameAudioSource;
    procedure FadeAll(ACurrentTimeMS, AFadeTimeMS: double);

    procedure Update(ATimeMS: double);
  end;

implementation

function GetContext: TJSAudioContext; assembler;
asm
  return new (window.AudioContext || window.webkitAudioContext)();
end;

constructor TGameAudio.Create;
begin
  inherited Create;
  fAudioCtx:=GetContext;
  fSources:=TList.Create;
end;

function TGameAudio.Play(ASource: TJSHTMLAudioElement; AVolume: double; ALooping: boolean): TGameAudioSource;
begin
  if asource=nil then exit;

  result:=TGameAudioSource.Create(ASource, AVolume, ALooping);
  fSources.Add(result);
end;

procedure TGameAudio.FadeAll(ACurrentTimeMS, AFadeTimeMS: double);
var
  el: JSValue;
begin
  for el in fSources do
    TGameAudioSource(el).FadeOut(ACurrentTimeMS, AFadeTimeMS);
end;

procedure TGameAudio.Update(ATimeMS: double);
var
  el: JSValue;
  toRemove: TList;
begin
  if fAudioCtx.state='suspended' then
    fAudioCtx.resume;

  toRemove:=TList.Create;

  for el in fSources do
  begin
    TGameAudioSource(el).Update(ATimeMS);
    if TGameAudioSource(el).State=psDone then
      toRemove.Add(el);
  end;

  for el in toRemove do
  begin
    fSources.Remove(el);
    TGameAudioSource(el).Destroy;
  end;

  toRemove.Free;
end;

function Clone(n: JSValue): JSValue; assembler;
asm
  return n.cloneNode();
end;

constructor TGameAudioSource.Create(ASource: TJSHTMLAudioElement; AVolume: double; ALooping: boolean);
begin
  inherited Create;
  fLooping:=ALooping;
  fAudio:=TJSHTMLAudioElement(Clone(ASource));
  fAudio.loop:=ALooping;
  fAudio.volume:=AVolume;
  fAudio.play;

  fState:=psNormal;
  fVolume:=AVolume;
end;

destructor TGameAudioSource.Destroy;
begin
  fAudio:=nil;
  inherited Destroy;
end;

procedure TGameAudioSource.FadeOut(AStartTime, ATime: double);
begin
  if fState=psNormal then
  begin
    fState:=psFadeout;
    fFadeStart:=AStartTime;
    fFadeTime:=ATime;
  end;
end;

function Lerp(a,b, t: double): double;
begin
  result:=(b-a)*t+a;
end;

procedure TGameAudioSource.Update(ATime: double);
var
  newVolume: Double;
begin
  if fState=psFadeout then
  begin
    newVolume:=Lerp(fVolume, 0, (ATime-fFadeStart)/fFadeTime);
    if newVolume<0 then
    begin
      fState:=psDone;
      fAudio.volume:=0;
    end
    else
      fAudio.volume:=newVolume;
  end
  else if fAudio.Ended then
  begin
    fState:=psDone;

    if fOnEnd<>nil then
      fOnEnd(self);
  end;
end;

end.

