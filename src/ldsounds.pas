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
  sounds.&set(name, snd);
end;

function GetSound(name: string): TJSHTMLAudioElement;
var
  res: JSValue;
begin
  res:=Sounds.get(name);
  if res=Undefined then
    result:=nil
  else
    result:=TJSHTMLAudioElement(res);
end;

initialization
  Sounds:=TJSmap.new;

end.

