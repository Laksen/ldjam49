unit GameVerlets;

{$mode ObjFPC}

interface

uses
  Classes, SysUtils,
  GameMath;

const
  Iterations = 10;

type
  TConstraint = record
    PA,PB: longint;
    RestLength: double;
  end;

  TParticleSystem = class
  private
    fParticleCount: longint;
    fX,
    fOldX,
    fA: array of TPVector;

    fConstraintCount: longint;
    fConstraints: array of TConstraint;

    fGravity: TPVector;

    function GetOldPosition(AIndex: longint): TPVector;
    function GetPosition(AIndex: longint): TPVector;
    procedure SetOldPosition(AIndex: longint; const AValue: TPVector);
    procedure SetPosition(AIndex: longint; const AValue: TPVector);
    procedure Verlet(ADelta: double);
    procedure SatisfyConstraints;
    procedure AccumulateForces;
  public
    constructor Create;

    function AddVerlet: longint;
    function AddConstraint(AA,AB: longint; ALength: double): longint;

    procedure TimeStep(ADelta: double);

    property Gravity: TPVector read fGravity write fGravity;

    property Position[AIndex: longint]: TPVector read GetPosition write SetPosition;
    property OldPosition[AIndex: longint]: TPVector read GetOldPosition write SetOldPosition;
  end;

implementation

procedure TParticleSystem.Verlet(ADelta: double);
var
  i: longint;
  oldx, temp, x, a: TPVector;
begin
  for i:=0 to fParticleCount-1 do
  begin
    temp:=fX[i];
    x:=temp;
    oldx:=fOldX[i];
    a:=fA[i];
    fX[i]:=x.Add(x.Sub(oldx).Add(a.Scale(sqr(ADelta))));
    fOldX[i]:=temp;
  end;
end;

function TParticleSystem.GetOldPosition(AIndex: longint): TPVector;
begin
  result:=fOldX[AIndex];
end;

function TParticleSystem.GetPosition(AIndex: longint): TPVector;
begin
  result:=fX[AIndex];
end;

procedure TParticleSystem.SetOldPosition(AIndex: longint; const AValue: TPVector);
begin
  fOldX[AIndex]:=AValue;
end;

procedure TParticleSystem.SetPosition(AIndex: longint; const AValue: TPVector);
begin
  fX[AIndex]:=AValue;
end;

procedure TParticleSystem.SatisfyConstraints;
var
  j,i: longint;
  x1, x2, delta: TPVector;
  c: TConstraint;
  deltaLength, diff: Double;
begin
  for i:=0 to fParticleCount-1 do
  begin
    fX[i]:=fX[i].Max(TPVector.New(0,0,0)).Min(TPVector.New(10,10,0));
  end;

  for j:=1 to Iterations do
  begin
    for i:=0 to fConstraintCount-1 do
    begin
      c:=fConstraints[i];
      x1:=fX[c.PA];
      x2:=fX[c.PB];
      delta:=x2.Sub(x1);

      {deltaLength:=delta.Length;
      diff:=(deltalength-c.RestLength)/deltalength;
      fX[c.PA]:=x1.Sub(delta.Scale(0.5*diff));
      fX[c.PB]:=x2.Add(delta.Scale(0.5*diff));}

      delta:=delta.Scale(Sqr(c.RestLength)/(delta.LengthSqr+Sqr(c.RestLength))-0.5);
      fX[c.PA]:=x1.Sub(delta);
      fX[c.PB]:=x2.Add(delta);
    end;
  end;
end;

procedure TParticleSystem.AccumulateForces;
var
  i: longint;
begin
  for i:=0 to fParticleCount-1 do
    fA[i]:=fGravity;
end;

constructor TParticleSystem.Create;
begin
  inherited Create;
  fParticleCount:=0;

  setlength(fX,16);
  setlength(fOldX,16);
  setlength(fA,16);

  fConstraintCount:=0;
  setlength(fConstraints, 16);
end;

function TParticleSystem.AddVerlet: longint;
var
  l: SizeInt;
begin
  if fParticleCount>=length(fX) then
  begin
    l:=length(fX)*4 div 3;

    setlength(fX,l);
    setlength(fOldX,l);
    setlength(fA,l);
  end;

  result:=fParticleCount;
  inc(fParticleCount);
end;

function TParticleSystem.AddConstraint(AA, AB: longint; ALength: double): longint;
var
  l: SizeInt;
begin
  if fConstraintCount>=length(fConstraints) then
  begin
    l:=length(fConstraints)*4 div 3;

    setlength(fConstraints,l);
  end;

  result:=fConstraintCount;
  fConstraints[result].PA:=AA;
  fConstraints[result].PB:=AB;
  fConstraints[result].RestLength:=ALength;
  inc(fConstraintCount);
end;

procedure TParticleSystem.TimeStep(ADelta: double);
begin
  AccumulateForces;
  Verlet(ADelta);
  SatisfyConstraints;
end;

end.

