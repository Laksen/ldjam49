unit guictrls;

{$mode objfpc}

interface

uses
  GameBase, GameSprite, GameMath, GameFont,
  guibase,
  web, webgl;

type
  TGUIImage = class(TGUIElement)
  private
    fAnimation: string;
    fSprite: TGameSprite;
    fTime: double;
  protected
    procedure Update(AGame: TGameBase; ATimeMS: double); override;
    procedure Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
  public
    property Sprite: TGameSprite read fSprite write fSprite;
    property Animation: string read fAnimation write fAnimation;
  end;

  TGUIPanel = class(TGUIElement)
  private
    fBackGround: TGameColor;
  protected
    procedure Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
  public
    constructor Create;

    property BackGround: TGameColor read fBackGround write fBackGround;
  end;

  TGUILabelVAlign = (vaTop, vaMiddle, vaBottom);
  TGUILabelHAlign = (haLeft, haMiddle, haRight);

  TGUILabel = class(TGUIElement)
  private
    fCaption: string;
    fColor: TGameColor;
    fFont: string;
    fHAlign: TGUILabelHAlign;
    fSize: longint;
    fVAlign: TGUILabelVAlign;

    fTextRun: TTextRun;
    procedure Redraw;

    procedure SetCaption(const AValue: string);
    procedure SetFont(AValue: string);
    procedure SetFontSize(AValue: longint);
  protected
    procedure Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
  public
    constructor Create;

    property Caption: string read fCaption write SetCaption;
    property Font: string read fFont write SetFont;
    property Size: longint read fSize write SetFontSize;

    property Color: TGameColor read fColor write fColor;

    property VAlign: TGUILabelVAlign read fVAlign write fVAlign;
    property HAlign: TGUILabelHAlign read fHAlign write fHAlign;
  end;

  TGUIInventory = class(TGUIElement)
  private
  public
  end;

implementation

uses
  sysutils;

function GetScreenQuad(APosition: TPVector; AWidth, AHeight: double): TGameQuad;
begin
  result[0]:=APosition.Add(TPVector.new(0,      0));
  result[1]:=APosition.Add(TPVector.new(AWidth, 0));
  result[2]:=APosition.Add(TPVector.new(AWidth, AHeight));
  result[3]:=APosition.Add(TPVector.new(0,      AHeight));
end;

procedure TGUIPanel.Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport);
begin
  RenderQuad(AContext, AViewport, GetScreenQuad(position,width,height), BackGround);

  inherited Render(AContext, AViewport);
end;

constructor TGUIPanel.Create;
begin
  inherited Create;
  fBackGround:=TGameColor.New(0,0,0);
end;

procedure TGUILabel.Redraw;
begin
  fTextRun:=GetFont(fFont).Draw(fCaption);
end;

procedure TGUILabel.SetCaption(const AValue: string);
begin
  if fCaption=AValue then Exit;
  fCaption:=AValue;

  Redraw;
end;

procedure TGUILabel.SetFont(AValue: string);
begin
  if fFont=AValue then Exit;
  fFont:=AValue;

  Redraw;
end;

procedure TGUILabel.SetFontSize(AValue: longint);
begin
  if fSize=AValue then Exit;
  fSize:=AValue;

  Redraw;
end;

procedure TGUILabel.Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport);
var
  measurement: TJSTextMetrics;
  ly, lx: double;
begin
  TGameFont.Render(AContext, fTextRun, AViewport, Color);

  inherited Render(AContext, AViewport);
end;

constructor TGUILabel.Create;
begin
  inherited Create;
  fColor:=TGameColor.New(0,0,0);
  fFont:='sans';
  fSize:=12;
  fVAlign:=vaMiddle;
  fHAlign:=haMiddle;
end;

procedure TGUIImage.Update(AGame: TGameBase; ATimeMS: double);
begin
  fTime:=ATimeMS/1000;
  inherited Update(AGame, ATimeMS);
end;

procedure TGUIImage.Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport);
begin
  RenderFrame(AContext, AViewport, GetScreenQuad(Position, Width,Height), fSprite.GetFrame(fAnimation, fTime));
  inherited Render(AContext, AViewport);
end;

end.

