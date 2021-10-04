unit ldsounds;

{$mode ObjFPC}

interface

uses
  js,web,
  Classes, SysUtils;

procedure AddSound(name: string; Snd: TJSHTMLAudioElement);
function GetSound(name: string): TJSHTMLAudioElement;

implementation
          
var
  Sounds: TJSMap;

procedure AddSound(name: string; Snd: TJSHTMLAudioElement);
begin
  if not sounds.has(name) then
    sounds.&set(name, tjsarray.new);

  TJSArray(sounds.get(name)).push(snd);
end;

function GetSound(name: string): TJSHTMLAudioElement;
var
  res: JSValue;
  r: TJSArray;
begin
  res:=Sounds.get(name);

  if res=Undefined then
    result:=nil
  else
  begin
    r:=tjsarray(res);

    result:=TJSHTMLAudioElement(r[Random(r.length)]);
  end;
end;

initialization
  Sounds:=TJSmap.new;

end.


