unit utils;

{$mode objfpc}
{$modeswitch advancedrecords}

interface

uses
  JS, Web, Webgl,
  GameBase,GameMath,
  Classes, SysUtils;

type
  TPoint = record
    X,Y: double;
    constructor Create(AX,AY: double);

    function Length: double;
    function Sub(const B: TPoint): TPoint;
    function Normalize: TPoint;
  end;

  TAnimatedSprite = class(TGameElement)
  private
    fCenter: boolean;
    fOwner: TGameBase;
    fCompleted: boolean;
    fFirst: boolean;
    fFrameTime, fStartTime: double;
    fRotation: double;
    fLooping: boolean;
    fCurrentFrame, fSourceFramesX,
    fSpriteWidth, fSpriteHeight, fSpriteCount: LongInt;
    fSource: TJSHTMLImageElement;
  public
    procedure Update(AGame: TGameBase; ATimeMS: double); override;
    procedure Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;

    constructor Create(ASource: TJSHTMLImageElement; ASpriteWidth, ASpriteHeight: longint; AFrameTime: double; ALooping: boolean=true; AOwner: TGameBase=nil);

    property Looping: boolean read fLooping;
    property Completed: boolean read fCompleted;

    property Center: boolean read fCenter write fCenter;
    property Rotation: double read fRotation write fRotation;
  end;

  TTrajectory = class(TGameElement)
  private
    fAccelerationY: Double;
    fFirst,
    fHit: boolean;
    fDir: TPoint;
    fHeight: double;
  protected
    procedure Update(AGame: TGameBase; ATimeMS: double); override;
  public
    constructor Create(AStart, AStop: TPoint; AVelocity, AMass: double);

    property Height: double read fHeight;
  end;

implementation

const
  G = 9.47;

procedure TTrajectory.Update(AGame: TGameBase; ATimeMS: double);
begin
  inherited Update(AGame, ATimeMS);
  //if fFirst then
    //fStartTime:=ATimeMS;

  //fHeight:=

  fFirst:=false;
end;

constructor TTrajectory.Create(AStart, AStop: TPoint; AVelocity, AMass: double);
var
  dir: TPoint;
begin
  inherited Create;
  fFirst:=true;
  fHit:=false;
  fHeight:=0;
  fDir:=AStop.Sub(AStart).Normalize;

  // F=m*a <= a=G/m
  // V=a*t+v0
  // Vx0=cos(ø)v0
  // Vy0=sin(ø)v0
  // Vy(t)=-a*t+Vy0
  // Py(t)=Vy(t)*t

  // X=dist
  // Y=0
  // Px(t)=Vx(t)*t=Vx0*t=cos(ø)*v0*t
  // Py(t)=Vy(t)*t=a*t^2+sin(ø)*v0*t

  // a*t^2+sin(ø)*v0*t=0
  // t=v*sin(ø)/a

  // cos(ø)*v*v*sin(ø)/a=l
  // ø=2*arctan(0.5*sqrt(power(v,4)/(sqr(a)*sqr(l))-4)+0.5*sqrt(2*power(v,4)/(sqr(a)*sqr(l))-0.25*(32*sqr(v)/(a*l)-8*power(v,6)/(power(a,3)*power(l,3)))/sqrt(power(v,4)/(sqr(a)*sqr(l))-4)) + 0.5*sqr(v)/(a*l))

  fAccelerationY:=G/AMass;

  Position:=TPVector.New(AStart.X,AStart.Y, 0);
end;

constructor TPoint.Create(AX, AY: double);
begin
  X:=AX;
  Y:=AY;
end;

function TPoint.Length: double;
begin
  result:=sqrt(sqr(x)+sqr(y));
end;

function TPoint.Sub(const B: TPoint): TPoint;
begin
  result.X:=X-B.X;
  result.Y:=Y-B.Y;
end;

function TPoint.Normalize: TPoint;
var
  l: double;
begin
  l:=Length;
  if l<=0 then
  begin
    result.X:=0;
    result.Y:=0;
  end
  else
  begin
    result.X:=X/l;
    result.Y:=Y/l;
  end;
end;

procedure TAnimatedSprite.Update(AGame: TGameBase; ATimeMS: double);
begin
  inherited Update(AGame, ATimeMS);
  if fFirst then
  begin
    fStartTime:=ATimeMS;
    fFirst:=false;
  end;

  fCurrentFrame:=trunc((ATimeMS-fStartTime)/fFrameTime);
  if fLooping then
    fCurrentFrame:=fCurrentFrame mod fSpriteCount
  else
  begin
    if fCurrentFrame>fSpriteCount then
    begin
      if assigned(fOwner) then
        fOwner.RemoveElement(self,true);
      fCompleted:=true;
    end;
  end;
end;

procedure TAnimatedSprite.Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport);
begin
  inherited Render(AContext, AViewport);

  {if not fCompleted then
  begin
    AContext.save;
    AContext.globalCompositeOperation:='lighter';

    if Center then
    begin
      AContext.translate(Position.X,Position.Y);
      AContext.rotate(fRotation);
      AContext.translate(-fSpriteWidth/2,-fSpriteHeight/2);
    end
    else
    begin
      AContext.translate(Position.X,Position.Y);
      AContext.rotate(fRotation);
    end;

    AContext.drawImage(fSource,
      (fCurrentFrame mod fSourceFramesX)*fSpriteWidth,(fCurrentFrame div fSourceFramesX)*fSpriteHeight,fSpriteWidth,fSpriteHeight,
      0,0,fSpriteWidth,fSpriteHeight);
    AContext.restore;
  end;}
end;

constructor TAnimatedSprite.Create(ASource: TJSHTMLImageElement; ASpriteWidth, ASpriteHeight: longint; AFrameTime: double; ALooping: boolean; AOwner: TGameBase);
begin
  inherited Create;
  fOwner:=AOwner;
  fLooping:=ALooping;
  fCompleted:=false;

  fFirst:=true;
  fSource:=ASource;
  fSpriteWidth:=ASpriteWidth;
  fSpriteHeight:=ASpriteHeight;
  fFrameTime:=AFrameTime*1000;
  fSpriteCount:=round(ASource.width*ASource.height / (ASpriteWidth*ASpriteHeight));
  fSourceFramesX:=round(ASource.width / ASpriteWidth);
end;

end.

