unit GameSprite;

{$mode ObjFPC}

interface

uses
  GameBase, GameMath,
  Classes, SysUtils;

type
  TGameFrame = record
    Image: TGameTexture;
    Start, Stop: TPVector;
    FrameTime: double;
  end;

  TGameAnimation = class
  private
    fName: string;

    fFrame: array of TGameFrame;
  public
    constructor Create(const AName: string);

    procedure AddFrame(AImage: TGameTexture; AStart, AStop: TPVector; AFrameTime: double);

    property Name: string read fName;
  end;



  TGameSprite = class
  public

  end;

implementation

constructor TGameAnimation.Create(const AName: string);
begin
  inherited Create;
  fName:=AName;
end;

procedure TGameAnimation.AddFrame(AImage: TGameTexture; AStart, AStop: TPVector; AFrameTime: double);
begin
  setlength(fFrame, high(fFrame)+2);

  fFrame[high(fFrame)].Image:=AImage;
  fFrame[high(fFrame)].Start:=AStart;
  fFrame[high(fFrame)].Stop :=AStop;
  fFrame[high(fFrame)].FrameTime:=AFrameTime;
end;

end.

