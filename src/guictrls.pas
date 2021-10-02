unit guictrls;

{$mode objfpc}

interface

uses
  GameBase,
  guibase,
  web, webgl;

type
  TGUIImage = class(TGUIElement)
  private
    fImage: TJSElement;
  protected
    procedure Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
  public
    property Image: TJSElement read fImage write fImage;
  end;

  TGUIPanel = class(TGUIElement)
  private
    fBackGround: string;
  protected
    procedure Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
  public
    constructor Create;

    property BackGround: string read fBackGround write fBackGround;
  end;

  TGUILabelVAlign = (vaTop, vaMiddle, vaBottom);
  TGUILabelHAlign = (haLeft, haMiddle, haRight);

  TGUILabel = class(TGUIElement)
  private
    fCaption: string;
    fFormat,
    fFont: string;
    fHAlign: TGUILabelHAlign;
    fSize: longint;
    fVAlign: TGUILabelVAlign;
    procedure SetFont(AValue: string);
    procedure SetSize(AValue: longint);
  protected
    procedure Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
  public
    constructor Create;

    property Caption: string read fCaption write fCaption;
    property Font: string read fFont write SetFont;
    property Size: longint read fSize write SetSize;

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

procedure TGUIPanel.Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport);
begin
  {AContext.save;
  AContext.fillStyle:=fBackGround;
  AContext.fillRect(Position.X,Position.Y, Width,Height);
  AContext.restore;}

  inherited Render(AContext, AViewport);
end;

constructor TGUIPanel.Create;
begin
  inherited Create;
  fBackGround:='rgb(0,0,0,0.0)';
end;

procedure TGUILabel.SetFont(AValue: string);
begin
  if fFont=AValue then Exit;
  fFont:=AValue;

  fFormat:=Format('%dpx %s', [fSize,fFont]);
end;

procedure TGUILabel.SetSize(AValue: longint);
begin
  if fSize=AValue then Exit;
  fSize:=AValue;                            
  fFormat:=Format('%dpx %s', [fSize,fFont]);
end;

procedure TGUILabel.Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport);
var
  measurement: TJSTextMetrics;
  ly, lx: double;
begin
  {AContext.save;

  case VAlign of
    vaTop:
      begin
        ly:=Position.Y;
        AContext.textBaseline:='top';
      end;
    vaMiddle:
      begin
        ly:=Position.Y+Height/2;
        AContext.textBaseline:='middle';
      end;
    vaBottom:
      begin
        ly:=Position.Y+Height;
        AContext.textBaseline:='bottom';
      end;
  end;
  AContext.font:=fFormat;
  measurement:=AContext.measureText(fCaption);

  case HAlign of
    haLeft:   lx:=Position.X;
    haMiddle: lx:=Position.X+(Width-measurement.width)/2;
    haRight:  lx:=Position.X+Width-measurement.width;
  end;

  AContext.fillText(fCaption, lX, lY);

  AContext.restore;}
  inherited Render(AContext, AViewport);
end;

constructor TGUILabel.Create;
begin
  inherited Create;
  fFont:='sans';
  fSize:=12;
  fVAlign:=vaMiddle;
  fHAlign:=haMiddle;
end;

procedure TGUIImage.Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport);
begin
  //AContext.drawImage(fImage, Position.X, Position.Y, Width, Height);
  inherited Render(AContext, AViewport);
end;

end.

