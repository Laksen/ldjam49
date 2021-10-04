unit guictrls;

{$mode objfpc}

interface

uses
  GameBase, GameSprite, GameMath, GameFont,
  guibase,
  web, webgl, js;

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

  TGUIInventoryItem = class(TGUIPanel)
  private
    fHoverColor: TGameColor;
    fItem: TGameSprite;
    fItems: Integer;
    fAnimation: String;

    fLabel: TGUILabel;
    procedure SetItems(const AValue: integer);
  protected
    procedure Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;

    procedure DoMouseEnter(const ACoord: TGUIPoint); override;
    procedure DoMouseLeave(const ACoord: TGUIPoint); override;
  public
    procedure SetSize(AX, AY, AWidth, AHeight: longint); override;

    constructor Create(AItem: TGameSprite; AAnimation: string);

    property HoverColor: TGameColor read fHoverColor write fHoverColor;
    property Item: TGameSprite read fItem;
    property Count: integer read fItems write SetItems;
    property Animation: string read fAnimation;
  end;

  TInventoryClick = procedure(AItem: TGameSprite) of object;

  TGUIInventory = class(TGUIElement)
  private
    fHoverColor: TGameColor;
    fItemHeight: integer;
    fItems: TJSArray;
    fItemWidth: integer;
    fOnClickItem: TInventoryClick;
    fChanged: boolean;
    procedure ClickItem(ATarget: TGUIElement; const APosition: TGUIPoint);
    procedure RepackItems;
  protected
    procedure Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
  public
    constructor Create;

    procedure AddElements(AItem: TGameSprite; ACount: longint);
    function RemoveElements(AItem: TGameSprite; ACount: longint): boolean;
    function ElementCount(AItem: TGameSprite): longint;

    property ItemHeight: integer read fItemHeight write fItemHeight;
    property ItemWidth: integer read fItemWidth write fItemWidth;
    property HoverColor: TGameColor read fHoverColor write fHoverColor;

    property OnClickItem: TInventoryClick read fOnClickItem write fOnClickItem;
  end;

  TDialogClick = procedure(AIndex: longint) of object;

  TGUIDialogOption = class(TGUIPanel)
  private
    fIndex: longint;
    fHoverColor: TGameColor;
    fText: String;

    fLabel: TGUILabel;
  protected
    procedure Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;

    procedure DoMouseEnter(const ACoord: TGUIPoint); override;
    procedure DoMouseLeave(const ACoord: TGUIPoint); override;
  public
    constructor Create(AIndex: longint; AText: string);

    procedure SetSize(AX, AY, AWidth, AHeight: longint); override;

    property Index: longint read fIndex;   
    property HoverColor: TGameColor read fHoverColor write fHoverColor;
  end;

  TGUIDialogs = class(TGUIPanel)
  private
    fHoverColor: TGameColor;
    fItemHeight: integer;
    fOnClickItem: TDialogClick;
    procedure ClickItem(ATarget: TGUIElement; const APosition: TGUIPoint);
  protected
    procedure Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport); override;
  public
    constructor Create;

    procedure Clear;
    procedure AddItem(AIndex: longint; const AText: string);

    property ItemHeight: integer read fItemHeight write fItemHeight;
    property HoverColor: TGameColor read fHoverColor write fHoverColor;

    property OnClickItem: TDialogClick read fOnClickItem write fOnClickItem;
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

procedure TGUIDialogOption.Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport);
begin
  inherited Render(AContext, AViewport);
  RenderFrame(AContext, AViewport, GetScreenQuad(Position, Height,Height), GetSprite('icon-bullet').GetFrame('idle', 0));
end;

procedure TGUIDialogOption.DoMouseEnter(const ACoord: TGUIPoint);
begin
  inherited DoMouseEnter(ACoord);
  BackGround:=HoverColor;
end;

procedure TGUIDialogOption.DoMouseLeave(const ACoord: TGUIPoint);
begin                      
  BackGround:=TGameColor.Transparent;
  inherited DoMouseLeave(ACoord);
end;       

procedure TGUIDialogOption.SetSize(AX, AY, AWidth, AHeight: longint);
begin
  inherited SetSize(AX, AY, AWidth, AHeight);
  fLabel.Size:=Height;
  fLabel.SetSize(Height,0,10000,Height);
end;

constructor TGUIDialogOption.Create(AIndex: longint; AText: string);
begin
  inherited Create;
  fText:=AText;
  fIndex:=AIndex;

  fHoverColor:=TGameColor.Transparent;
  BackGround:=TGameColor.Transparent;

  fLabel:=TGUILabel.Create;
  AddChild(fLabel);
  fLabel.HitTestVisible:=false;
  fLabel.SetSize(Height,0,10000,Height);
  fLabel.Caption:=AText;
end;

procedure TGUIDialogs.ClickItem(ATarget: TGUIElement; const APosition: TGUIPoint);
var
  res: TGUIDialogOption;
begin
  res:=TGUIDialogOption(atarget);
  if fOnClickItem<>Nil then
    fOnClickItem(res.Index);
end;

procedure TGUIDialogs.Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport);
begin
  inherited Render(AContext, AViewport);
end;

constructor TGUIDialogs.Create;
begin
  inherited Create;
end;

procedure TGUIDialogs.Clear;
var
  c: TGUIElement;
  i: LongInt;
begin
  for i:=ChildCount-1 downto 0 do
  begin
    c:=Child[i];
    RemoveChild(c);
    c.free;
  end;
end;

procedure TGUIDialogs.AddItem(AIndex: longint; const AText: string);
var
  c: TGUIDialogOption;
begin
  c:=TGUIDialogOption.Create(aindex, atext);
  c.SetSize(0,ChildCount*ItemHeight,Width,itemheight);
  c.OnClick:=@ClickItem;                    
  c.HoverColor:=fHoverColor;

  AddChild(c);
end;

procedure TGUIInventoryItem.SetItems(const AValue: integer);
begin
  if fItems=AValue then Exit;
  fItems:=AValue;

  flabel.Caption:=inttostr(AValue);
end;

procedure TGUIInventoryItem.Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport);
begin
  inherited Render(acontext, AViewport);
  RenderFrame(AContext, AViewport, GetScreenQuad(Position, Height,Height), fItem.GetFrame(fAnimation, 0));
end;

procedure TGUIInventoryItem.DoMouseEnter(const ACoord: TGUIPoint);
begin
  inherited DoMouseEnter(ACoord);
  BackGround:=HoverColor;
end;

procedure TGUIInventoryItem.DoMouseLeave(const ACoord: TGUIPoint);
begin
  BackGround:=TGameColor.Transparent;
  inherited DoMouseLeave(ACoord);
end;

procedure TGUIInventoryItem.SetSize(AX, AY, AWidth, AHeight: longint);
begin
  inherited SetSize(AX, AY, AWidth, AHeight);
  fLabel.Size:=Height;
  fLabel.SetSize(Height,0,10000,Height);
end;

constructor TGUIInventoryItem.Create(AItem: TGameSprite; AAnimation: string);
begin
  inherited Create;
  fHoverColor:=TGameColor.Transparent;
  BackGround:=TGameColor.Transparent;
  fItem:=AItem;
  fItems:=0;
  fAnimation:=AAnimation;

  fLabel:=TGUILabel.Create;
  AddChild(fLabel);
  fLabel.HitTestVisible:=false;
  fLabel.SetSize(Height,0,10000,Height);
  fLabel.Caption:='0';
end;

procedure TGUIInventory.RepackItems;
var
  x,y: longint;
  el: JSValue;
  e: TGUIInventoryItem;
begin
  x:=0;
  y:=0;

  for el in fItems do
  begin
    e:=TGUIInventoryItem(el);
    e.SetSize(x,y,fItemWidth,fItemHeight);

    x:=x+fItemWidth;
    if (x+fItemWidth-1)>=Width then
    begin
      inc(y, fItemHeight);
      x:=0;
    end;
  end;
end;

procedure TGUIInventory.Render(AContext: TJSWebGLRenderingContext; const AViewport: TGameViewport); 
var
  el: JSValue;
  e: TGUIInventoryItem;
  toFree: TJSArray;
  idx: NativeInt;
begin                                   
  if fChanged then
  begin
    toFree:=TJSArray.new;

    for el in fItems do
    begin
      e:=TGUIInventoryItem(el);
      if e.Count<=0 then
      begin
        toFree.push(el);
        RemoveChild(e);
      end;
    end;

    for el in toFree do
    begin
      idx:=fItems.indexOf(el);
      fItems.splice(idx, 1);

      e:=TGUIInventoryItem(el);
      e.Free;
    end;

    RepackItems;
    fchanged:=false;
  end;

  inherited Render(AContext, AViewport);
end;

procedure TGUIInventory.ClickItem(ATarget: TGUIElement; const APosition: TGUIPoint);
begin
  if assigned(fOnClickItem) then
    fOnClickItem(TGUIInventoryItem(ATarget).Item);
end;

constructor TGUIInventory.Create;
begin
  inherited Create;
  fItems:=TJSArray.new;
  fItemHeight:=35;
  fItemWidth:=70;
end;

procedure TGUIInventory.AddElements(AItem: TGameSprite; ACount: longint);
var
  el: JSValue;
  e: TGUIInventoryItem;
begin
  for el in fItems do
  begin
    e:=TGUIInventoryItem(el);

    if (e.Item=AItem) then
    begin
      e.Count:=e.Count + acount;
      exit;
    end;
  end;

  e:=TGUIInventoryItem.Create(AItem,'idle');
  e.Count:=ACount;
  e.OnClick:=@ClickItem;
  e.HoverColor:=fHoverColor;
  fItems.push(e);

  AddChild(e);
  fchanged:=true;
end;

function TGUIInventory.RemoveElements(AItem: TGameSprite; ACount: longint): boolean;
var
  el: JSValue;
  e: TGUIInventoryItem;
begin
  for el in fItems do
  begin
    e:=TGUIInventoryItem(el);

    if (e.Item=AItem) then
    begin
      if e.count>=ACount then
      begin
        e.Count:=e.Count - acount; 
        fchanged:=true;
        exit(true);
      end
      else
        exit(false);
    end;
  end;
end;

function TGUIInventory.ElementCount(AItem: TGameSprite): longint;
var
  el: JSValue;
  e: TGUIInventoryItem;
begin
  for el in fItems do
  begin
    e:=TGUIInventoryItem(el);

    if (e.Item=AItem) then
      exit(e.Count);
  end;

  result:=0;
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
  SubViewPort: TGameViewport;
  H, Scaling: Double;
begin                                                
  H:=fTextRun.LineHeight-fTextRun.Y;
  Scaling:=fSize / H;

  SubViewPort:=AViewport;
  SubViewPort.ModelView:=TPMatrix.CreateTranslation(-fTextRun.X, -fTextRun.Y, 0)
    .Multiply(TPMatrix.CreateScale(scaling, scaling,1))
    .Multiply(AViewport.ModelView)
    .Multiply(TPMatrix.CreateTranslation(Position.X, Position.Y, 0));

  TGameFont.Render(AContext, fTextRun, SubViewPort, Color, color.a);

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
  if Sprite<>nil then
    RenderFrame(AContext, AViewport, GetScreenQuad(Position, Width,Height), fSprite.GetFrame(fAnimation, fTime));
  inherited Render(AContext, AViewport);
end;

end.

