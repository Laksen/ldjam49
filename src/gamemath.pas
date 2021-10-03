unit GameMath;

{$mode ObjFPC}
{$modeswitch AdvancedRecords}

interface

uses
  Classes, SysUtils,
  Math;

type
  TPVector = record
    X,Y,Z: double;
    class function New(AX,AY: double; AZ: double = 0): TPVector; static;

    function Length: double;
    function LengthSqr: double;

    function Normalize: TPVector;

    function Dot(const A: TPVector): double;

    function Min(const A: TPVector): TPVector;
    function Max(const A: TPVector): TPVector;

    function Add(const A: TPVector): TPVector;
    function Sub(const A: TPVector): TPVector;
    function RSub(const A: TPVector): TPVector;
    function Multiply(const A: TPVector): TPVector;
    function Scale(const A: double): TPVector;

    function Clamp(const AMin, AMax: TPVector): TPVector;

    class function Cross(A,B: TPVector): TPVector; static;
  end;

  TPRect = record
  private
    function GetP01: TPVector;
    function GetP10: TPVector;
  public
    P0, P1: TPVector;

    property P01: TPVector read GetP01;
    property P10: TPVector read GetP10;
  end;

  TPMatrixArray = array[0..15] of double;

  TPMatrix = class
  private
    fIsIdentity,
    fIsTranslation,
    fHasInverse: boolean;

    inv,
    V: TPMatrixArray;

    function GetInverse: TPMatrix;
    function GetTranslation: TPVector;
  public
    constructor Create(const AMatrix: TPMatrixArray);
    constructor Identity;
    constructor CreateTranslation(AX,AY,AZ: double);
    constructor CreateRotationX(ARotation: double);
    constructor CreateRotationY(ARotation: double);
    constructor CreateRotationZ(ARotation: double);
    constructor CreateScale(AX,AY,AZ: double);

    constructor Ortho(const ALeft, ARight, ABottom, ATop, AZNear, AZFar: double);
		constructor Perspective(const AFovY, AAspectRatio, AZNear, AZFar: double);

    constructor LookAt(ATarget, AOrigin, AUp: TPVector);

    procedure Load(const AMatrix: TPMatrix);

    function Multiply(const AVec: TPVector): TPVector;
    function Multiply(const AMat: TPMatrix): TPMatrix;
    function Transpose: TPMatrix;

    procedure MultiplyInPlace(const AMatrix: TPMatrix);
    procedure TransformInplace(var AVectors: array of TPVector);

    property Translation: TPVector read GetTranslation;

    property IsIdentity: boolean read fIsIdentity;
    property IsTranslation: boolean read fIsTranslation;

    property Raw: TPMatrixArray read V;
    property Inverse: TPMatrix read GetInverse;
  end;

implementation

function TPRect.GetP01: TPVector;
begin
  result.X:=P0.X;
  result.Y:=P1.Y;
end;

function TPRect.GetP10: TPVector;
begin
  result.X:=P1.X;
  result.Y:=P0.Y;
end;

function TPMatrix.GetTranslation: TPVector;
begin
  result:=TPVector.New(V[3], V[7], V[11]);
end;

function TPMatrix.GetInverse: TPMatrix;
var
  det: Double;
  i: longint;
begin
  if not fHasInverse then
  begin
    inv[0] := v[5]  * v[10] * v[15] -
             v[5]  * v[11] * v[14] -
             v[9]  * v[6]  * v[15] +
             v[9]  * v[7]  * v[14] +
             v[13] * v[6]  * v[11] -
             v[13] * v[7]  * v[10];

    inv[4] := -v[4]  * v[10] * v[15] +
              v[4]  * v[11] * v[14] +
              v[8]  * v[6]  * v[15] -
              v[8]  * v[7]  * v[14] -
              v[12] * v[6]  * v[11] +
              v[12] * v[7]  * v[10];

    inv[8] := v[4]  * v[9] * v[15] -
             v[4]  * v[11] * v[13] -
             v[8]  * v[5] * v[15] +
             v[8]  * v[7] * v[13] +
             v[12] * v[5] * v[11] -
             v[12] * v[7] * v[9];

    inv[12] := -v[4]  * v[9] * v[14] +
               v[4]  * v[10] * v[13] +
               v[8]  * v[5] * v[14] -
               v[8]  * v[6] * v[13] -
               v[12] * v[5] * v[10] +
               v[12] * v[6] * v[9];

    inv[1] := -v[1]  * v[10] * v[15] +
              v[1]  * v[11] * v[14] +
              v[9]  * v[2] * v[15] -
              v[9]  * v[3] * v[14] -
              v[13] * v[2] * v[11] +
              v[13] * v[3] * v[10];

    inv[5] := v[0]  * v[10] * v[15] -
             v[0]  * v[11] * v[14] -
             v[8]  * v[2] * v[15] +
             v[8]  * v[3] * v[14] +
             v[12] * v[2] * v[11] -
             v[12] * v[3] * v[10];

    inv[9] := -v[0]  * v[9] * v[15] +
              v[0]  * v[11] * v[13] +
              v[8]  * v[1] * v[15] -
              v[8]  * v[3] * v[13] -
              v[12] * v[1] * v[11] +
              v[12] * v[3] * v[9];

    inv[13] := v[0]  * v[9] * v[14] -
              v[0]  * v[10] * v[13] -
              v[8]  * v[1] * v[14] +
              v[8]  * v[2] * v[13] +
              v[12] * v[1] * v[10] -
              v[12] * v[2] * v[9];

    inv[2] := v[1]  * v[6] * v[15] -
             v[1]  * v[7] * v[14] -
             v[5]  * v[2] * v[15] +
             v[5]  * v[3] * v[14] +
             v[13] * v[2] * v[7] -
             v[13] * v[3] * v[6];

    inv[6] := -v[0]  * v[6] * v[15] +
              v[0]  * v[7] * v[14] +
              v[4]  * v[2] * v[15] -
              v[4]  * v[3] * v[14] -
              v[12] * v[2] * v[7] +
              v[12] * v[3] * v[6];

    inv[10] := v[0]  * v[5] * v[15] -
              v[0]  * v[7] * v[13] -
              v[4]  * v[1] * v[15] +
              v[4]  * v[3] * v[13] +
              v[12] * v[1] * v[7] -
              v[12] * v[3] * v[5];

    inv[14] := -v[0]  * v[5] * v[14] +
               v[0]  * v[6] * v[13] +
               v[4]  * v[1] * v[14] -
               v[4]  * v[2] * v[13] -
               v[12] * v[1] * v[6] +
               v[12] * v[2] * v[5];

    inv[3] := -v[1] * v[6] * v[11] +
              v[1] * v[7] * v[10] +
              v[5] * v[2] * v[11] -
              v[5] * v[3] * v[10] -
              v[9] * v[2] * v[7] +
              v[9] * v[3] * v[6];

    inv[7] := v[0] * v[6] * v[11] -
             v[0] * v[7] * v[10] -
             v[4] * v[2] * v[11] +
             v[4] * v[3] * v[10] +
             v[8] * v[2] * v[7] -
             v[8] * v[3] * v[6];

    inv[11] := -v[0] * v[5] * v[11] +
               v[0] * v[7] * v[9] +
               v[4] * v[1] * v[11] -
               v[4] * v[3] * v[9] -
               v[8] * v[1] * v[7] +
               v[8] * v[3] * v[5];

    inv[15] := v[0] * v[5] * v[10] -
              v[0] * v[6] * v[9] -
              v[4] * v[1] * v[10] +
              v[4] * v[2] * v[9] +
              v[8] * v[1] * v[6] -
              v[8] * v[2] * v[5];

    det := v[0] * inv[0] + v[1] * inv[4] + v[2] * inv[8] + v[3] * inv[12];

    if det = 0 then
    begin            
      writeln('fff');
      exit(identity);
    end;

    det := 1.0 / det;

    for i:=0 to 15 do
        inv[i] := inv[i] * det;

    fHasInverse:=true;
  end;

  result:=TPMatrix.Create(inv);
end;

constructor TPMatrix.Create(const AMatrix: TPMatrixArray);
begin
  V:=AMatrix;

  fIsIdentity:=false;
  fIsTranslation:=false;
end;

constructor TPMatrix.Identity;
var
  i: SizeInt;
begin
  for i:=0 to 8 do
    V[i]:=0;

  V[0]:=1;
  V[5]:=1;
  V[10]:=1;
  V[15]:=1;

  fIsIdentity:=true;
  fIsTranslation:=true;
end;

constructor TPMatrix.CreateTranslation(AX, AY, AZ: double);
begin
  Identity;

  V[12]:=AX;
  V[13]:=AY;
  V[14]:=AZ;

  fIsIdentity:=false;
  fIsTranslation:=true;
end;

constructor TPMatrix.CreateRotationX(ARotation: double);
var
  cs, ss: Double;
begin
  Identity;

  if ARotation<>0 then
  begin
    cs:=cos(arotation);
    ss:=sin(arotation);

    V[5] :=cs;
    V[6] :=ss;
    V[9] :=-ss;
    V[10]:=cs;

    fIsIdentity:=false;
    fIsTranslation:=false;
  end
end;

constructor TPMatrix.CreateRotationY(ARotation: double);
var
  cs, ss: Double;
begin
  Identity;

  if ARotation<>0 then
  begin
    cs:=cos(arotation);
    ss:=sin(arotation);

    V[0] :=cs;
    V[2] :=-ss;
    V[8] :=ss;
    V[10]:=cs;

    fIsIdentity:=false;
    fIsTranslation:=false;
  end
end;

constructor TPMatrix.CreateRotationZ(ARotation: double);
var
  cs, ss: Double;
begin
  Identity;

  if ARotation<>0 then
  begin
    cs:=cos(arotation);
    ss:=sin(arotation);

    V[0]:=cs;
    V[1]:=-ss;
    V[4]:=ss;
    V[5]:=cs;

    fIsIdentity:=false;
    fIsTranslation:=false;
  end
end;

constructor TPMatrix.CreateScale(AX, AY, AZ: double);
begin
  Identity;

  V[0] :=AX;
  V[5] :=AY;
  V[10]:=AZ;

  fIsIdentity:=false;
  fIsTranslation:=false;
end;

constructor TPMatrix.Ortho(const ALeft, ARight, ABottom, ATop, AZNear, AZFar: double);
var
	Width, Height, Depth: double;
begin
  Width:=ARight-ALeft;
  Height:=ATop-ABottom;
  Depth:=AZFar-AZNear;

  Identity;

  V[0] :=2.0/Width;
  V[5] :=2.0/Height;
  V[10]:=(-2.0)/Depth;

  V[12] :=-(ARight+ALeft)/Width;
  V[13] :=-(ATop+ABottom)/Height;
  V[11]:=-(AZFar+AZNear)/Depth;

  fIsIdentity:=false;
  fIsTranslation:=false;
end;

constructor TPMatrix.Perspective(const AFovY, AAspectRatio, AZNear, AZFar: double);
var
  s: double;
begin
  Identity;

  s:=AFovY * (0.5 * pi / 180);
  s:=cos(s)/sin(s); // 1/tan(s)

  V[0] :=s/AAspectRatio;
  V[5] :=s;
  V[10]:=-(AZFar+AZNear)/(AZFar-AZNear);
  V[11]:=-1;
  V[14]:=-(2*AZFar*AZNear)/(AZFar-AZNear);
  V[15]:=0;

  fIsIdentity:=false;
  fIsTranslation:=false;
end;

constructor TPMatrix.LookAt(ATarget, AOrigin, AUp: TPVector);
var
  zaxis, yaxis, xaxis: TPVector;
begin
  Identity;

  zaxis:=ATarget.Sub(AOrigin).Normalize;
  xaxis:=TPVector.Cross(zaxis, AUp).Normalize;
  yaxis:=TPVector.Cross(xaxis, zaxis);

  {V:=[xaxis.x, xaxis.y, xaxis.z, 0,
      yaxis.x, yaxis.y, yaxis.z, 0,
      zaxis.x, zaxis.y, zaxis.z, 0,
      //xaxis.dot(AOrigin), yaxis.dot(AOrigin), zaxis.dot(AOrigin), 1];
      -AOrigin.x, -AOrigin.y, -AOrigin.z, 1];}

  zaxis:=zaxis.Scale(-1);

  V:=[xaxis.x, yaxis.x, zaxis.x, 0,
      xaxis.y, yaxis.y, zaxis.y, 0,
      xaxis.z, yaxis.z, zaxis.z, 0,
      -xaxis.dot(AOrigin), -yaxis.dot(AOrigin), -zaxis.dot(AOrigin), 1];

  fIsIdentity:=false;
  fIsTranslation:=false;
end;

procedure TPMatrix.Load(const AMatrix: TPMatrix);
begin
  v:=AMatrix.V;

  fIsIdentity:=false;
  fIsTranslation:=false;
end;

procedure TPMatrix.MultiplyInPlace(const AMatrix: TPMatrix);
var
  n, v2: TPMatrixArray;
  i, i2, i3: Integer;
  s: double;
begin
  v2:=AMatrix.V;
  for i:=0 to 3 do
    for i2:=0 to 3 do
    begin
      s:=0;
      for i3:=0 to 3 do
        s:=s+v[i*4+i3]*v2[i3*4+i2];

      n[i*4+i2]:=s;
    end;

  v:=n;

  fIsIdentity:=fIsIdentity and AMatrix.IsIdentity;
  fIsTranslation:=fIsTranslation and AMatrix.IsTranslation;
end;

procedure TPMatrix.TransformInplace(var AVectors: array of TPVector);
var
  i: SizeInt;
  x, y, z: Double;
begin
  if fIsIdentity then
    exit;

  if fIsTranslation then
    for i:=low(AVectors) to high(AVectors) do
    begin
      AVectors[i].X:=AVectors[i].X+V[3];
      AVectors[i].Y:=AVectors[i].Y+V[7];
      AVectors[i].Z:=AVectors[i].Z+V[11];
    end
  else
    for i:=low(AVectors) to high(AVectors) do
    begin
      x:=AVectors[i].X;
      y:=AVectors[i].y;
      z:=AVectors[i].z;

      AVectors[i].X:=X*V[0]+Y*V[1]+Z*V[2]+V[3];
      AVectors[i].Y:=X*V[4]+Y*V[5]+Z*V[6]+V[7];
      AVectors[i].Z:=X*V[8]+Y*V[9]+Z*V[10]+V[11];
    end;
end;

function TPMatrix.Multiply(const AVec: TPVector): TPVector;
begin
  if fIsIdentity then
    exit(AVec);

  if fIsTranslation then
  begin
    Result.X:=AVec.X+V[3];
    Result.Y:=AVec.Y+V[7];
    Result.Z:=AVec.Z+V[11];
  end
  else
  begin
    Result.X:=AVec.X*V[0]+AVec.Y*V[1]+AVec.Z*V[2]+V[3];
    Result.Y:=AVec.X*V[4]+AVec.Y*V[5]+AVec.Z*V[6]+V[7];
    Result.Z:=AVec.X*V[8]+AVec.Y*V[9]+AVec.Z*V[10]+V[11];
  end;
end;

function TPMatrix.Multiply(const AMat: TPMatrix): TPMatrix;
var
  n, v2: TPMatrixArray;
  i, i2, i3: Integer;
  s: double;
begin
  v2:=AMat.V;
  for i:=0 to 3 do
    for i2:=0 to 3 do
    begin
      s:=0;
      for i3:=0 to 3 do
        s:=s+v[i*4+i3]*v2[i3*4+i2];

      n[i*4+i2]:=s;
    end;

  result:=TPMatrix.Create(n);
end;

function TPMatrix.Transpose: TPMatrix;
begin
  result:=TPMatrix.Create([V[0], V[4], V[8],  V[12],
                           V[1], V[5], V[9],  V[13],
                           V[2], V[6], V[10], V[14],
                           V[3], V[7], V[11], V[15]]);
end;


class function TPVector.New(AX, AY: double; AZ: double): TPVector;
begin
  result.X:=AX;
  result.Y:=AY;
  result.Z:=AZ;
end;

function TPVector.Length: double;
begin
  result:=sqr(X)+sqr(Y)+sqr(Z);
  if result>0 then
    result:=sqrt(result);
end;

function TPVector.LengthSqr: double;
begin
  result:=sqr(X)+sqr(Y)+sqr(Z);
end;

function TPVector.Normalize: TPVector;
var
  l: Double;
begin
  l:=Length;
  if l<>0 then
    result:=Scale(1/l)
  else
    result:=TPVector.New(0,0,0);
end;

function TPVector.Dot(const A: TPVector): double;
begin
  result:=X*A.X+Y*A.Y+Z*A.Z;
end;

function TPVector.Min(const A: TPVector): TPVector;
begin
  result.X:=Math.Min(X, A.X);
  result.Y:=Math.Min(Y, A.Y);
  result.Z:=Math.Min(Z, A.Z);
end;

function TPVector.Max(const A: TPVector): TPVector;
begin
  result.X:=Math.Max(X, A.X);
  result.Y:=Math.Max(Y, A.Y);
  result.Z:=Math.Max(Z, A.Z);
end;

function TPVector.Add(const A: TPVector): TPVector;
begin
  result.X:=X+A.X;
  result.Y:=Y+A.Y;
  result.Z:=Z+A.Z;
end;

function TPVector.Sub(const A: TPVector): TPVector;
begin
  result.X:=X-A.X;
  result.Y:=Y-A.Y;
  result.Z:=Z-A.Z;
end;

function TPVector.RSub(const A: TPVector): TPVector;
begin
  result.X:=A.X-X;
  result.Y:=A.Y-Y;
  result.Z:=A.Z-Z;
end;

function TPVector.Multiply(const A: TPVector): TPVector;
begin
  result.X:=X*A.X;
  result.Y:=Y*A.Y;
  result.Z:=Z*A.Z;
end;

function TPVector.Scale(const A: double): TPVector;
begin
  result.X:=X*A;
  result.Y:=Y*A;
  result.Z:=Z*A;
end;

function FClamp(AValue, amin, amax: double): double;
begin
  if AValue<amin then
    result:=AMin
  else if AValue>amax then
    result:=AMax
  else
    result:=AValue;
end;

function TPVector.Clamp(const AMin, AMax: TPVector): TPVector;
begin
  result.X:=FClamp(X,AMin.X,AMax.X);
  result.Y:=FClamp(Y,AMin.Y,AMax.Y);
  result.Z:=FClamp(Z,AMin.Z,AMax.Z);
end;

class function TPVector.Cross(A, B: TPVector): TPVector;
begin
  result.X:=A.Y*B.Z-A.Z*B.Y;
  result.y:=A.z*B.x-A.x*B.z;
  result.z:=A.x*B.y-A.y*B.x;
end;

end.

