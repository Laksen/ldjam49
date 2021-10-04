var pas = {};

var rtl = {

  version: 20101,

  quiet: false,
  debug_load_units: false,
  debug_rtti: false,

  $res : {},

  debug: function(){
    if (rtl.quiet || !console || !console.log) return;
    console.log(arguments);
  },

  error: function(s){
    rtl.debug('Error: ',s);
    throw s;
  },

  warn: function(s){
    rtl.debug('Warn: ',s);
  },

  checkVersion: function(v){
    if (rtl.version != v) throw "expected rtl version "+v+", but found "+rtl.version;
  },

  hiInt: Math.pow(2,53),

  hasString: function(s){
    return rtl.isString(s) && (s.length>0);
  },

  isArray: function(a) {
    return Array.isArray(a);
  },

  isFunction: function(f){
    return typeof(f)==="function";
  },

  isModule: function(m){
    return rtl.isObject(m) && rtl.hasString(m.$name) && (pas[m.$name]===m);
  },

  isImplementation: function(m){
    return rtl.isObject(m) && rtl.isModule(m.$module) && (m.$module.$impl===m);
  },

  isNumber: function(n){
    return typeof(n)==="number";
  },

  isObject: function(o){
    var s=typeof(o);
    return (typeof(o)==="object") && (o!=null);
  },

  isString: function(s){
    return typeof(s)==="string";
  },

  getNumber: function(n){
    return typeof(n)==="number"?n:NaN;
  },

  getChar: function(c){
    return ((typeof(c)==="string") && (c.length===1)) ? c : "";
  },

  getObject: function(o){
    return ((typeof(o)==="object") || (typeof(o)==='function')) ? o : null;
  },

  isTRecord: function(type){
    return (rtl.isObject(type) && type.hasOwnProperty('$new') && (typeof(type.$new)==='function'));
  },

  isPasClass: function(type){
    return (rtl.isObject(type) && type.hasOwnProperty('$classname') && rtl.isObject(type.$module));
  },

  isPasClassInstance: function(type){
    return (rtl.isObject(type) && rtl.isPasClass(type.$class));
  },

  hexStr: function(n,digits){
    return ("000000000000000"+n.toString(16).toUpperCase()).slice(-digits);
  },

  m_loading: 0,
  m_loading_intf: 1,
  m_intf_loaded: 2,
  m_loading_impl: 3, // loading all used unit
  m_initializing: 4, // running initialization
  m_initialized: 5,

  module: function(module_name, intfuseslist, intfcode, impluseslist){
    if (rtl.debug_load_units) rtl.debug('rtl.module name="'+module_name+'" intfuses='+intfuseslist+' impluses='+impluseslist);
    if (!rtl.hasString(module_name)) rtl.error('invalid module name "'+module_name+'"');
    if (!rtl.isArray(intfuseslist)) rtl.error('invalid interface useslist of "'+module_name+'"');
    if (!rtl.isFunction(intfcode)) rtl.error('invalid interface code of "'+module_name+'"');
    if (!(impluseslist==undefined) && !rtl.isArray(impluseslist)) rtl.error('invalid implementation useslist of "'+module_name+'"');

    if (pas[module_name])
      rtl.error('module "'+module_name+'" is already registered');

    var r = Object.create(rtl.tSectionRTTI);
    var module = r.$module = pas[module_name] = {
      $name: module_name,
      $intfuseslist: intfuseslist,
      $impluseslist: impluseslist,
      $state: rtl.m_loading,
      $intfcode: intfcode,
      $implcode: null,
      $impl: null,
      $rtti: r
    };
    if (impluseslist) module.$impl = {
          $module: module,
          $rtti: r
        };
  },

  exitcode: 0,

  run: function(module_name){
    try {
      if (!rtl.hasString(module_name)) module_name='program';
      if (rtl.debug_load_units) rtl.debug('rtl.run module="'+module_name+'"');
      rtl.initRTTI();
      var module = pas[module_name];
      if (!module) rtl.error('rtl.run module "'+module_name+'" missing');
      rtl.loadintf(module);
      rtl.loadimpl(module);
      if (module_name=='program'){
        if (rtl.debug_load_units) rtl.debug('running $main');
        var r = pas.program.$main();
        if (rtl.isNumber(r)) rtl.exitcode = r;
      }
    } catch(re) {
      if (!rtl.showUncaughtExceptions) {
        throw re
      } else {  
        if (!rtl.handleUncaughtException(re)) {
          rtl.showException(re);
          rtl.exitcode = 216;
        }  
      }
    } 
    return rtl.exitcode;
  },
  
  showException : function (re) {
    var errMsg = rtl.hasString(re.$classname) ? re.$classname : '';
    errMsg +=  ((errMsg) ? ': ' : '') + (re.hasOwnProperty('fMessage') ? re.fMessage : re);
    alert('Uncaught Exception : '+errMsg);
  },

  handleUncaughtException: function (e) {
    if (rtl.onUncaughtException) {
      try {
        rtl.onUncaughtException(e);
        return true;
      } catch (ee) {
        return false; 
      }
    } else {
      return false;
    }
  },

  loadintf: function(module){
    if (module.$state>rtl.m_loading_intf) return; // already finished
    if (rtl.debug_load_units) rtl.debug('loadintf: "'+module.$name+'"');
    if (module.$state===rtl.m_loading_intf)
      rtl.error('unit cycle detected "'+module.$name+'"');
    module.$state=rtl.m_loading_intf;
    // load interfaces of interface useslist
    rtl.loaduseslist(module,module.$intfuseslist,rtl.loadintf);
    // run interface
    if (rtl.debug_load_units) rtl.debug('loadintf: run intf of "'+module.$name+'"');
    module.$intfcode(module.$intfuseslist);
    // success
    module.$state=rtl.m_intf_loaded;
    // Note: units only used in implementations are not yet loaded (not even their interfaces)
  },

  loaduseslist: function(module,useslist,f){
    if (useslist==undefined) return;
    var len = useslist.length;
    for (var i = 0; i<len; i++) {
      var unitname=useslist[i];
      if (rtl.debug_load_units) rtl.debug('loaduseslist of "'+module.$name+'" uses="'+unitname+'"');
      if (pas[unitname]==undefined)
        rtl.error('module "'+module.$name+'" misses "'+unitname+'"');
      f(pas[unitname]);
    }
  },

  loadimpl: function(module){
    if (module.$state>=rtl.m_loading_impl) return; // already processing
    if (module.$state<rtl.m_intf_loaded) rtl.error('loadimpl: interface not loaded of "'+module.$name+'"');
    if (rtl.debug_load_units) rtl.debug('loadimpl: load uses of "'+module.$name+'"');
    module.$state=rtl.m_loading_impl;
    // load interfaces of implementation useslist
    rtl.loaduseslist(module,module.$impluseslist,rtl.loadintf);
    // load implementation of interfaces useslist
    rtl.loaduseslist(module,module.$intfuseslist,rtl.loadimpl);
    // load implementation of implementation useslist
    rtl.loaduseslist(module,module.$impluseslist,rtl.loadimpl);
    // Note: At this point all interfaces used by this unit are loaded. If
    //   there are implementation uses cycles some used units might not yet be
    //   initialized. This is by design.
    // run implementation
    if (rtl.debug_load_units) rtl.debug('loadimpl: run impl of "'+module.$name+'"');
    if (rtl.isFunction(module.$implcode)) module.$implcode(module.$impluseslist);
    // run initialization
    if (rtl.debug_load_units) rtl.debug('loadimpl: run init of "'+module.$name+'"');
    module.$state=rtl.m_initializing;
    if (rtl.isFunction(module.$init)) module.$init();
    // unit initialized
    module.$state=rtl.m_initialized;
  },

  createCallback: function(scope, fn){
    var cb;
    if (typeof(fn)==='string'){
      if (!scope.hasOwnProperty('$events')) scope.$events = {};
      cb = scope.$events[fn];
      if (cb) return cb;
      scope.$events[fn] = cb = function(){
        return scope[fn].apply(scope,arguments);
      };
    } else {
      cb = function(){
        return fn.apply(scope,arguments);
      };
    };
    cb.scope = scope;
    cb.fn = fn;
    return cb;
  },

  createSafeCallback: function(scope, fn){
    var cb;
    if (typeof(fn)==='string'){
      if (!scope.hasOwnProperty('$events')) scope.$events = {};
      cb = scope.$events[fn];
      if (cb) return cb;
      scope.$events[fn] = cb = function(){
        try{
          return scope[fn].apply(scope,arguments);
        } catch (err) {
          if (!rtl.handleUncaughtException(err)) throw err;
        }
      };
    } else {
      cb = function(){
        try{
          return fn.apply(scope,arguments);
        } catch (err) {
          if (!rtl.handleUncaughtException(err)) throw err;
        }
      };
    };
    cb.scope = scope;
    cb.fn = fn;
    return cb;
  },

  eqCallback: function(a,b){
    // can be a function or a function wrapper
    if (a===b){
      return true;
    } else {
      return (a!=null) && (b!=null) && (a.fn) && (a.scope===b.scope) && (a.fn===b.fn);
    }
  },

  initStruct: function(c,parent,name){
    if ((parent.$module) && (parent.$module.$impl===parent)) parent=parent.$module;
    c.$parent = parent;
    if (rtl.isModule(parent)){
      c.$module = parent;
      c.$name = name;
    } else {
      c.$module = parent.$module;
      c.$name = parent.$name+'.'+name;
    };
    return parent;
  },

  initClass: function(c,parent,name,initfn,rttiname){
    parent[name] = c;
    c.$class = c; // Note: o.$class === Object.getPrototypeOf(o)
    c.$classname = rttiname?rttiname:name;
    parent = rtl.initStruct(c,parent,name);
    c.$fullname = parent.$name+'.'+name;
    // rtti
    if (rtl.debug_rtti) rtl.debug('initClass '+c.$fullname);
    var t = c.$module.$rtti.$Class(c.$classname,{ "class": c });
    c.$rtti = t;
    if (rtl.isObject(c.$ancestor)) t.ancestor = c.$ancestor.$rtti;
    if (!t.ancestor) t.ancestor = null;
    // init members
    initfn.call(c);
  },

  createClass: function(parent,name,ancestor,initfn,rttiname){
    // create a normal class,
    // ancestor must be null or a normal class,
    // the root ancestor can be an external class
    var c = null;
    if (ancestor != null){
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
      // Note:
      // if root is an "object" then c.$ancestor === Object.getPrototypeOf(c)
      // if root is a "function" then c.$ancestor === c.__proto__, Object.getPrototypeOf(c) returns the root
    } else {
      c = { $ancestor: null };
      c.$create = function(fn,args){
        if (args == undefined) args = [];
        var o = Object.create(this);
        o.$init();
        try{
          if (typeof(fn)==="string"){
            o[fn].apply(o,args);
          } else {
            fn.apply(o,args);
          };
          o.AfterConstruction();
        } catch($e){
          // do not call BeforeDestruction
          if (o.Destroy) o.Destroy();
          o.$final();
          throw $e;
        }
        return o;
      };
      c.$destroy = function(fnname){
        this.BeforeDestruction();
        if (this[fnname]) this[fnname]();
        this.$final();
      };
    };
    rtl.initClass(c,parent,name,initfn,rttiname);
  },

  createClassExt: function(parent,name,ancestor,newinstancefnname,initfn,rttiname){
    // Create a class using an external ancestor.
    // If newinstancefnname is given, use that function to create the new object.
    // If exist call BeforeDestruction and AfterConstruction.
    var isFunc = rtl.isFunction(ancestor);
    var c = null;
    if (isFunc){
      // create pascal class descendent from JS function
      c = Object.create(ancestor.prototype);
      c.$ancestorfunc = ancestor;
      c.$ancestor = null; // no pascal ancestor
    } else if (ancestor.$func){
      // create pascal class descendent from a pascal class descendent of a JS function
      isFunc = true;
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
    } else {
      c = Object.create(ancestor);
      c.$ancestor = null; // no pascal ancestor
    }
    c.$create = function(fn,args){
      if (args == undefined) args = [];
      var o = null;
      if (newinstancefnname.length>0){
        o = this[newinstancefnname](fn,args);
      } else if(isFunc) {
        o = new this.$func(args);
      } else {
        o = Object.create(c);
      }
      if (o.$init) o.$init();
      try{
        if (typeof(fn)==="string"){
          this[fn].apply(o,args);
        } else {
          fn.apply(o,args);
        };
        if (o.AfterConstruction) o.AfterConstruction();
      } catch($e){
        // do not call BeforeDestruction
        if (o.Destroy) o.Destroy();
        if (o.$final) o.$final();
        throw $e;
      }
      return o;
    };
    c.$destroy = function(fnname){
      if (this.BeforeDestruction) this.BeforeDestruction();
      if (this[fnname]) this[fnname]();
      if (this.$final) this.$final();
    };
    rtl.initClass(c,parent,name,initfn,rttiname);
    if (isFunc){
      function f(){}
      f.prototype = c;
      c.$func = f;
    }
  },

  createHelper: function(parent,name,ancestor,initfn,rttiname){
    // create a helper,
    // ancestor must be null or a helper,
    var c = null;
    if (ancestor != null){
      c = Object.create(ancestor);
      c.$ancestor = ancestor;
      // c.$ancestor === Object.getPrototypeOf(c)
    } else {
      c = { $ancestor: null };
    };
    parent[name] = c;
    c.$class = c; // Note: o.$class === Object.getPrototypeOf(o)
    c.$classname = rttiname?rttiname:name;
    parent = rtl.initStruct(c,parent,name);
    c.$fullname = parent.$name+'.'+name;
    // rtti
    var t = c.$module.$rtti.$Helper(c.$classname,{ "helper": c });
    c.$rtti = t;
    if (rtl.isObject(ancestor)) t.ancestor = ancestor.$rtti;
    if (!t.ancestor) t.ancestor = null;
    // init members
    initfn.call(c);
  },

  tObjectDestroy: "Destroy",

  free: function(obj,name){
    if (obj[name]==null) return null;
    obj[name].$destroy(rtl.tObjectDestroy);
    obj[name]=null;
  },

  freeLoc: function(obj){
    if (obj==null) return null;
    obj.$destroy(rtl.tObjectDestroy);
    return null;
  },

  hideProp: function(o,p,v){
    Object.defineProperty(o,p, {
      enumerable: false,
      configurable: true,
      writable: true
    });
    if(arguments.length>2){ o[p]=v; }
  },

  recNewT: function(parent,name,initfn,full){
    // create new record type
    var t = {};
    if (parent) parent[name] = t;
    var h = rtl.hideProp;
    if (full){
      rtl.initStruct(t,parent,name);
      t.$record = t;
      h(t,'$record');
      h(t,'$name');
      h(t,'$parent');
      h(t,'$module');
      h(t,'$initSpec');
    }
    initfn.call(t);
    if (!t.$new){
      t.$new = function(){ return Object.create(t); };
    }
    t.$clone = function(r){ return t.$new().$assign(r); };
    h(t,'$new');
    h(t,'$clone');
    h(t,'$eq');
    h(t,'$assign');
    return t;
  },

  is: function(instance,type){
    return type.isPrototypeOf(instance) || (instance===type);
  },

  isExt: function(instance,type,mode){
    // mode===1 means instance must be a Pascal class instance
    // mode===2 means instance must be a Pascal class
    // Notes:
    // isPrototypeOf and instanceof return false on equal
    // isPrototypeOf does not work for Date.isPrototypeOf(new Date())
    //   so if isPrototypeOf is false test with instanceof
    // instanceof needs a function on right side
    if (instance == null) return false; // Note: ==null checks for undefined too
    if ((typeof(type) !== 'object') && (typeof(type) !== 'function')) return false;
    if (instance === type){
      if (mode===1) return false;
      if (mode===2) return rtl.isPasClass(instance);
      return true;
    }
    if (type.isPrototypeOf && type.isPrototypeOf(instance)){
      if (mode===1) return rtl.isPasClassInstance(instance);
      if (mode===2) return rtl.isPasClass(instance);
      return true;
    }
    if ((typeof type == 'function') && (instance instanceof type)) return true;
    return false;
  },

  Exception: null,
  EInvalidCast: null,
  EAbstractError: null,
  ERangeError: null,
  EIntOverflow: null,
  EPropWriteOnly: null,

  raiseE: function(typename){
    var t = rtl[typename];
    if (t==null){
      var mod = pas.SysUtils;
      if (!mod) mod = pas.sysutils;
      if (mod){
        t = mod[typename];
        if (!t) t = mod[typename.toLowerCase()];
        if (!t) t = mod['Exception'];
        if (!t) t = mod['exception'];
      }
    }
    if (t){
      if (t.Create){
        throw t.$create("Create");
      } else if (t.create){
        throw t.$create("create");
      }
    }
    if (typename === "EInvalidCast") throw "invalid type cast";
    if (typename === "EAbstractError") throw "Abstract method called";
    if (typename === "ERangeError") throw "range error";
    throw typename;
  },

  as: function(instance,type){
    if((instance === null) || rtl.is(instance,type)) return instance;
    rtl.raiseE("EInvalidCast");
  },

  asExt: function(instance,type,mode){
    if((instance === null) || rtl.isExt(instance,type,mode)) return instance;
    rtl.raiseE("EInvalidCast");
  },

  createInterface: function(module, name, guid, fnnames, ancestor, initfn){
    //console.log('createInterface name="'+name+'" guid="'+guid+'" names='+fnnames);
    var i = ancestor?Object.create(ancestor):{};
    module[name] = i;
    i.$module = module;
    i.$name = name;
    i.$fullname = module.$name+'.'+name;
    i.$guid = guid;
    i.$guidr = null;
    i.$names = fnnames?fnnames:[];
    if (rtl.isFunction(initfn)){
      // rtti
      if (rtl.debug_rtti) rtl.debug('createInterface '+i.$fullname);
      var t = i.$module.$rtti.$Interface(name,{ "interface": i, module: module });
      i.$rtti = t;
      if (ancestor) t.ancestor = ancestor.$rtti;
      if (!t.ancestor) t.ancestor = null;
      initfn.call(i);
    }
    return i;
  },

  strToGUIDR: function(s,g){
    var p = 0;
    function n(l){
      var h = s.substr(p,l);
      p+=l;
      return parseInt(h,16);
    }
    p+=1; // skip {
    g.D1 = n(8);
    p+=1; // skip -
    g.D2 = n(4);
    p+=1; // skip -
    g.D3 = n(4);
    p+=1; // skip -
    if (!g.D4) g.D4=[];
    g.D4[0] = n(2);
    g.D4[1] = n(2);
    p+=1; // skip -
    for(var i=2; i<8; i++) g.D4[i] = n(2);
    return g;
  },

  guidrToStr: function(g){
    if (g.$intf) return g.$intf.$guid;
    var h = rtl.hexStr;
    var s='{'+h(g.D1,8)+'-'+h(g.D2,4)+'-'+h(g.D3,4)+'-'+h(g.D4[0],2)+h(g.D4[1],2)+'-';
    for (var i=2; i<8; i++) s+=h(g.D4[i],2);
    s+='}';
    return s;
  },

  createTGUID: function(guid){
    var TGuid = (pas.System)?pas.System.TGuid:pas.system.tguid;
    var g = rtl.strToGUIDR(guid,TGuid.$new());
    return g;
  },

  getIntfGUIDR: function(intfTypeOrVar){
    if (!intfTypeOrVar) return null;
    if (!intfTypeOrVar.$guidr){
      var g = rtl.createTGUID(intfTypeOrVar.$guid);
      if (!intfTypeOrVar.hasOwnProperty('$guid')) intfTypeOrVar = Object.getPrototypeOf(intfTypeOrVar);
      g.$intf = intfTypeOrVar;
      intfTypeOrVar.$guidr = g;
    }
    return intfTypeOrVar.$guidr;
  },

  addIntf: function (aclass, intf, map){
    function jmp(fn){
      if (typeof(fn)==="function"){
        return function(){ return fn.apply(this.$o,arguments); };
      } else {
        return function(){ rtl.raiseE('EAbstractError'); };
      }
    }
    if(!map) map = {};
    var t = intf;
    var item = Object.create(t);
    if (!aclass.hasOwnProperty('$intfmaps')) aclass.$intfmaps = {};
    aclass.$intfmaps[intf.$guid] = item;
    do{
      var names = t.$names;
      if (!names) break;
      for (var i=0; i<names.length; i++){
        var intfname = names[i];
        var fnname = map[intfname];
        if (!fnname) fnname = intfname;
        //console.log('addIntf: intftype='+t.$name+' index='+i+' intfname="'+intfname+'" fnname="'+fnname+'" old='+typeof(item[intfname]));
        item[intfname] = jmp(aclass[fnname]);
      }
      t = Object.getPrototypeOf(t);
    }while(t!=null);
  },

  getIntfG: function (obj, guid, query){
    if (!obj) return null;
    //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' query='+query);
    // search
    var maps = obj.$intfmaps;
    if (!maps) return null;
    var item = maps[guid];
    if (!item) return null;
    // check delegation
    //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' query='+query+' item='+typeof(item));
    if (typeof item === 'function') return item.call(obj); // delegate. Note: COM contains _AddRef
    // check cache
    var intf = null;
    if (obj.$interfaces){
      intf = obj.$interfaces[guid];
      //console.log('getIntfG: obj='+obj.$classname+' guid='+guid+' cache='+typeof(intf));
    }
    if (!intf){ // intf can be undefined!
      intf = Object.create(item);
      intf.$o = obj;
      if (!obj.$interfaces) obj.$interfaces = {};
      obj.$interfaces[guid] = intf;
    }
    if (typeof(query)==='object'){
      // called by queryIntfT
      var o = null;
      if (intf.QueryInterface(rtl.getIntfGUIDR(query),
          {get:function(){ return o; }, set:function(v){ o=v; }}) === 0){
        return o;
      } else {
        return null;
      }
    } else if(query===2){
      // called by TObject.GetInterfaceByStr
      if (intf.$kind === 'com') intf._AddRef();
    }
    return intf;
  },

  getIntfT: function(obj,intftype){
    return rtl.getIntfG(obj,intftype.$guid);
  },

  queryIntfT: function(obj,intftype){
    return rtl.getIntfG(obj,intftype.$guid,intftype);
  },

  queryIntfIsT: function(obj,intftype){
    var i = rtl.getIntfG(obj,intftype.$guid);
    if (!i) return false;
    if (i.$kind === 'com') i._Release();
    return true;
  },

  asIntfT: function (obj,intftype){
    var i = rtl.getIntfG(obj,intftype.$guid);
    if (i!==null) return i;
    rtl.raiseEInvalidCast();
  },

  intfIsIntfT: function(intf,intftype){
    return (intf!==null) && rtl.queryIntfIsT(intf.$o,intftype);
  },

  intfAsIntfT: function (intf,intftype){
    if (!intf) return null;
    var i = rtl.getIntfG(intf.$o,intftype.$guid);
    if (i) return i;
    rtl.raiseEInvalidCast();
  },

  intfIsClass: function(intf,classtype){
    return (intf!=null) && (rtl.is(intf.$o,classtype));
  },

  intfAsClass: function(intf,classtype){
    if (intf==null) return null;
    return rtl.as(intf.$o,classtype);
  },

  intfToClass: function(intf,classtype){
    if ((intf!==null) && rtl.is(intf.$o,classtype)) return intf.$o;
    return null;
  },

  // interface reference counting
  intfRefs: { // base object for temporary interface variables
    ref: function(id,intf){
      // called for temporary interface references needing delayed release
      var old = this[id];
      //console.log('rtl.intfRefs.ref: id='+id+' old="'+(old?old.$name:'null')+'" intf="'+(intf?intf.$name:'null')+' $o='+(intf?intf.$o:'null'));
      if (old){
        // called again, e.g. in a loop
        delete this[id];
        old._Release(); // may fail
      }
      if(intf) {
        this[id]=intf;
      }
      return intf;
    },
    free: function(){
      //console.log('rtl.intfRefs.free...');
      for (var id in this){
        if (this.hasOwnProperty(id)){
          var intf = this[id];
          if (intf){
            //console.log('rtl.intfRefs.free: id='+id+' '+intf.$name+' $o='+intf.$o.$classname);
            intf._Release();
          }
        }
      }
    }
  },

  createIntfRefs: function(){
    //console.log('rtl.createIntfRefs');
    return Object.create(rtl.intfRefs);
  },

  setIntfP: function(path,name,value,skipAddRef){
    var old = path[name];
    //console.log('rtl.setIntfP path='+path+' name='+name+' old="'+(old?old.$name:'null')+'" value="'+(value?value.$name:'null')+'"');
    if (old === value) return;
    if (old !== null){
      path[name]=null;
      old._Release();
    }
    if (value !== null){
      if (!skipAddRef) value._AddRef();
      path[name]=value;
    }
  },

  setIntfL: function(old,value,skipAddRef){
    //console.log('rtl.setIntfL old="'+(old?old.$name:'null')+'" value="'+(value?value.$name:'null')+'"');
    if (old !== value){
      if (value!==null){
        if (!skipAddRef) value._AddRef();
      }
      if (old!==null){
        old._Release();  // Release after AddRef, to avoid double Release if Release creates an exception
      }
    } else if (skipAddRef){
      if (old!==null){
        old._Release();  // value has an AddRef
      }
    }
    return value;
  },

  _AddRef: function(intf){
    //if (intf) console.log('rtl._AddRef intf="'+(intf?intf.$name:'null')+'"');
    if (intf) intf._AddRef();
    return intf;
  },

  _Release: function(intf){
    //if (intf) console.log('rtl._Release intf="'+(intf?intf.$name:'null')+'"');
    if (intf) intf._Release();
    return intf;
  },

  trunc: function(a){
    return a<0 ? Math.ceil(a) : Math.floor(a);
  },

  checkMethodCall: function(obj,type){
    if (rtl.isObject(obj) && rtl.is(obj,type)) return;
    rtl.raiseE("EInvalidCast");
  },

  oc: function(i){
    // overflow check integer
    if ((Math.floor(i)===i) && (i>=-0x1fffffffffffff) && (i<=0x1fffffffffffff)) return i;
    rtl.raiseE('EIntOverflow');
  },

  rc: function(i,minval,maxval){
    // range check integer
    if ((Math.floor(i)===i) && (i>=minval) && (i<=maxval)) return i;
    rtl.raiseE('ERangeError');
  },

  rcc: function(c,minval,maxval){
    // range check char
    if ((typeof(c)==='string') && (c.length===1)){
      var i = c.charCodeAt(0);
      if ((i>=minval) && (i<=maxval)) return c;
    }
    rtl.raiseE('ERangeError');
  },

  rcSetCharAt: function(s,index,c){
    // range check setCharAt
    if ((typeof(s)!=='string') || (index<0) || (index>=s.length)) rtl.raiseE('ERangeError');
    return rtl.setCharAt(s,index,c);
  },

  rcCharAt: function(s,index){
    // range check charAt
    if ((typeof(s)!=='string') || (index<0) || (index>=s.length)) rtl.raiseE('ERangeError');
    return s.charAt(index);
  },

  rcArrR: function(arr,index){
    // range check read array
    if (Array.isArray(arr) && (typeof(index)==='number') && (index>=0) && (index<arr.length)){
      if (arguments.length>2){
        // arr,index1,index2,...
        arr=arr[index];
        for (var i=2; i<arguments.length; i++) arr=rtl.rcArrR(arr,arguments[i]);
        return arr;
      }
      return arr[index];
    }
    rtl.raiseE('ERangeError');
  },

  rcArrW: function(arr,index,value){
    // range check write array
    // arr,index1,index2,...,value
    for (var i=3; i<arguments.length; i++){
      arr=rtl.rcArrR(arr,index);
      index=arguments[i-1];
      value=arguments[i];
    }
    if (Array.isArray(arr) && (typeof(index)==='number') && (index>=0) && (index<arr.length)){
      return arr[index]=value;
    }
    rtl.raiseE('ERangeError');
  },

  length: function(arr){
    return (arr == null) ? 0 : arr.length;
  },

  arrayRef: function(a){
    if (a!=null) rtl.hideProp(a,'$pas2jsrefcnt',1);
    return a;
  },

  arraySetLength: function(arr,defaultvalue,newlength){
    var stack = [];
    var s = 9999;
    for (var i=2; i<arguments.length; i++){
      var j = arguments[i];
      if (j==='s'){ s = i-2; }
      else {
        stack.push({ dim:j+0, a:null, i:0, src:null });
      }
    }
    var dimmax = stack.length-1;
    var depth = 0;
    var lastlen = 0;
    var item = null;
    var a = null;
    var src = arr;
    var srclen = 0, oldlen = 0;
    do{
      if (depth>0){
        item=stack[depth-1];
        src = (item.src && item.src.length>item.i)?item.src[item.i]:null;
      }
      if (!src){
        a = [];
        srclen = 0;
        oldlen = 0;
      } else if (src.$pas2jsrefcnt>0 || depth>=s){
        a = [];
        srclen = src.length;
        oldlen = srclen;
      } else {
        a = src;
        srclen = 0;
        oldlen = a.length;
      }
      lastlen = stack[depth].dim;
      a.length = lastlen;
      if (depth>0){
        item.a[item.i]=a;
        item.i++;
        if ((lastlen===0) && (item.i<item.a.length)) continue;
      }
      if (lastlen>0){
        if (depth<dimmax){
          item = stack[depth];
          item.a = a;
          item.i = 0;
          item.src = src;
          depth++;
          continue;
        } else {
          if (srclen>lastlen) srclen=lastlen;
          if (rtl.isArray(defaultvalue)){
            // array of dyn array
            for (var i=0; i<srclen; i++) a[i]=src[i];
            for (var i=oldlen; i<lastlen; i++) a[i]=[];
          } else if (rtl.isObject(defaultvalue)) {
            if (rtl.isTRecord(defaultvalue)){
              // array of record
              for (var i=0; i<srclen; i++) a[i]=defaultvalue.$clone(src[i]);
              for (var i=oldlen; i<lastlen; i++) a[i]=defaultvalue.$new();
            } else {
              // array of set
              for (var i=0; i<srclen; i++) a[i]=rtl.refSet(src[i]);
              for (var i=oldlen; i<lastlen; i++) a[i]={};
            }
          } else {
            for (var i=0; i<srclen; i++) a[i]=src[i];
            for (var i=oldlen; i<lastlen; i++) a[i]=defaultvalue;
          }
        }
      }
      // backtrack
      while ((depth>0) && (stack[depth-1].i>=stack[depth-1].dim)){
        depth--;
      };
      if (depth===0){
        if (dimmax===0) return a;
        return stack[0].a;
      }
    }while (true);
  },

  arrayEq: function(a,b){
    if (a===null) return b===null;
    if (b===null) return false;
    if (a.length!==b.length) return false;
    for (var i=0; i<a.length; i++) if (a[i]!==b[i]) return false;
    return true;
  },

  arrayClone: function(type,src,srcpos,endpos,dst,dstpos){
    // type: 0 for references, "refset" for calling refSet(), a function for new type()
    // src must not be null
    // This function does not range check.
    if(type === 'refSet') {
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = rtl.refSet(src[srcpos]); // ref set
    } else if (rtl.isTRecord(type)){
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = type.$clone(src[srcpos]); // clone record
    }  else {
      for (; srcpos<endpos; srcpos++) dst[dstpos++] = src[srcpos]; // reference
    };
  },

  arrayConcat: function(type){
    // type: see rtl.arrayClone
    var a = [];
    var l = 0;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src !== null) l+=src.length;
    };
    a.length = l;
    l=0;
    for (var i=1; i<arguments.length; i++){
      var src = arguments[i];
      if (src === null) continue;
      rtl.arrayClone(type,src,0,src.length,a,l);
      l+=src.length;
    };
    return a;
  },

  arrayConcatN: function(){
    var a = null;
    for (var i=0; i<arguments.length; i++){
      var src = arguments[i];
      if (src === null) continue;
      if (a===null){
        a=rtl.arrayRef(src); // Note: concat(a) does not clone
      } else {
        a=a.concat(src);
      }
    };
    return a;
  },

  arrayCopy: function(type, srcarray, index, count){
    // type: see rtl.arrayClone
    // if count is missing, use srcarray.length
    if (srcarray === null) return [];
    if (index < 0) index = 0;
    if (count === undefined) count=srcarray.length;
    var end = index+count;
    if (end>srcarray.length) end = srcarray.length;
    if (index>=end) return [];
    if (type===0){
      return srcarray.slice(index,end);
    } else {
      var a = [];
      a.length = end-index;
      rtl.arrayClone(type,srcarray,index,end,a,0);
      return a;
    }
  },

  arrayInsert: function(item, arr, index){
    if (arr){
      arr.splice(index,0,item);
      return arr;
    } else {
      return [item];
    }
  },

  setCharAt: function(s,index,c){
    return s.substr(0,index)+c+s.substr(index+1);
  },

  getResStr: function(mod,name){
    var rs = mod.$resourcestrings[name];
    return rs.current?rs.current:rs.org;
  },

  createSet: function(){
    var s = {};
    for (var i=0; i<arguments.length; i++){
      if (arguments[i]!=null){
        s[arguments[i]]=true;
      } else {
        var first=arguments[i+=1];
        var last=arguments[i+=1];
        for(var j=first; j<=last; j++) s[j]=true;
      }
    }
    return s;
  },

  cloneSet: function(s){
    var r = {};
    for (var key in s) r[key]=true;
    return r;
  },

  refSet: function(s){
    rtl.hideProp(s,'$shared',true);
    return s;
  },

  includeSet: function(s,enumvalue){
    if (s.$shared) s = rtl.cloneSet(s);
    s[enumvalue] = true;
    return s;
  },

  excludeSet: function(s,enumvalue){
    if (s.$shared) s = rtl.cloneSet(s);
    delete s[enumvalue];
    return s;
  },

  diffSet: function(s,t){
    var r = {};
    for (var key in s) if (!t[key]) r[key]=true;
    return r;
  },

  unionSet: function(s,t){
    var r = {};
    for (var key in s) r[key]=true;
    for (var key in t) r[key]=true;
    return r;
  },

  intersectSet: function(s,t){
    var r = {};
    for (var key in s) if (t[key]) r[key]=true;
    return r;
  },

  symDiffSet: function(s,t){
    var r = {};
    for (var key in s) if (!t[key]) r[key]=true;
    for (var key in t) if (!s[key]) r[key]=true;
    return r;
  },

  eqSet: function(s,t){
    for (var key in s) if (!t[key]) return false;
    for (var key in t) if (!s[key]) return false;
    return true;
  },

  neSet: function(s,t){
    return !rtl.eqSet(s,t);
  },

  leSet: function(s,t){
    for (var key in s) if (!t[key]) return false;
    return true;
  },

  geSet: function(s,t){
    for (var key in t) if (!s[key]) return false;
    return true;
  },

  strSetLength: function(s,newlen){
    var oldlen = s.length;
    if (oldlen > newlen){
      return s.substring(0,newlen);
    } else if (s.repeat){
      // Note: repeat needs ECMAScript6!
      return s+' '.repeat(newlen-oldlen);
    } else {
       while (oldlen<newlen){
         s+=' ';
         oldlen++;
       };
       return s;
    }
  },

  spaceLeft: function(s,width){
    var l=s.length;
    if (l>=width) return s;
    if (s.repeat){
      // Note: repeat needs ECMAScript6!
      return ' '.repeat(width-l) + s;
    } else {
      while (l<width){
        s=' '+s;
        l++;
      };
      return s;
    };
  },

  floatToStr: function(d,w,p){
    // input 1-3 arguments: double, width, precision
    if (arguments.length>2){
      return rtl.spaceLeft(d.toFixed(p),w);
    } else {
	  // exponent width
	  var pad = "";
	  var ad = Math.abs(d);
	  if (((ad>1) && (ad<1.0e+10)) ||  ((ad>1.e-10) && (ad<1))) {
		pad='00';
	  } else if ((ad>1) && (ad<1.0e+100) || (ad<1.e-10)) {
		pad='0';
      }  	
	  if (arguments.length<2) {
	    w=24;		
      } else if (w<9) {
		w=9;
      }		  
      var p = w-8;
      var s=(d>0 ? " " : "" ) + d.toExponential(p);
      s=s.replace(/e(.)/,'E$1'+pad);
      return rtl.spaceLeft(s,w);
    }
  },

  valEnum: function(s, enumType, setCodeFn){
    s = s.toLowerCase();
    for (var key in enumType){
      if((typeof(key)==='string') && (key.toLowerCase()===s)){
        setCodeFn(0);
        return enumType[key];
      }
    }
    setCodeFn(1);
    return 0;
  },

  lw: function(l){
    // fix longword bitwise operation
    return l<0?l+0x100000000:l;
  },

  and: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) & (b / hi);
    var l = (a & low) & (b & low);
    return h*hi + l;
  },

  or: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) | (b / hi);
    var l = (a & low) | (b & low);
    return h*hi + l;
  },

  xor: function(a,b){
    var hi = 0x80000000;
    var low = 0x7fffffff;
    var h = (a / hi) ^ (b / hi);
    var l = (a & low) ^ (b & low);
    return h*hi + l;
  },

  shr: function(a,b){
    if (a<0) a += rtl.hiInt;
    if (a<0x80000000) return a >> b;
    if (b<=0) return a;
    if (b>54) return 0;
    return Math.floor(a / Math.pow(2,b));
  },

  shl: function(a,b){
    if (a<0) a += rtl.hiInt;
    if (b<=0) return a;
    if (b>54) return 0;
    var r = a * Math.pow(2,b);
    if (r <= rtl.hiInt) return r;
    return r % rtl.hiInt;
  },

  initRTTI: function(){
    if (rtl.debug_rtti) rtl.debug('initRTTI');

    // base types
    rtl.tTypeInfo = { name: "tTypeInfo", kind: 0, $module: null, attr: null };
    function newBaseTI(name,kind,ancestor){
      if (!ancestor) ancestor = rtl.tTypeInfo;
      if (rtl.debug_rtti) rtl.debug('initRTTI.newBaseTI "'+name+'" '+kind+' ("'+ancestor.name+'")');
      var t = Object.create(ancestor);
      t.name = name;
      t.kind = kind;
      rtl[name] = t;
      return t;
    };
    function newBaseInt(name,minvalue,maxvalue,ordtype){
      var t = newBaseTI(name,1 /* tkInteger */,rtl.tTypeInfoInteger);
      t.minvalue = minvalue;
      t.maxvalue = maxvalue;
      t.ordtype = ordtype;
      return t;
    };
    newBaseTI("tTypeInfoInteger",1 /* tkInteger */);
    newBaseInt("shortint",-0x80,0x7f,0);
    newBaseInt("byte",0,0xff,1);
    newBaseInt("smallint",-0x8000,0x7fff,2);
    newBaseInt("word",0,0xffff,3);
    newBaseInt("longint",-0x80000000,0x7fffffff,4);
    newBaseInt("longword",0,0xffffffff,5);
    newBaseInt("nativeint",-0x10000000000000,0xfffffffffffff,6);
    newBaseInt("nativeuint",0,0xfffffffffffff,7);
    newBaseTI("char",2 /* tkChar */);
    newBaseTI("string",3 /* tkString */);
    newBaseTI("tTypeInfoEnum",4 /* tkEnumeration */,rtl.tTypeInfoInteger);
    newBaseTI("tTypeInfoSet",5 /* tkSet */);
    newBaseTI("double",6 /* tkDouble */);
    newBaseTI("boolean",7 /* tkBool */);
    newBaseTI("tTypeInfoProcVar",8 /* tkProcVar */);
    newBaseTI("tTypeInfoMethodVar",9 /* tkMethod */,rtl.tTypeInfoProcVar);
    newBaseTI("tTypeInfoArray",10 /* tkArray */);
    newBaseTI("tTypeInfoDynArray",11 /* tkDynArray */);
    newBaseTI("tTypeInfoPointer",15 /* tkPointer */);
    var t = newBaseTI("pointer",15 /* tkPointer */,rtl.tTypeInfoPointer);
    t.reftype = null;
    newBaseTI("jsvalue",16 /* tkJSValue */);
    newBaseTI("tTypeInfoRefToProcVar",17 /* tkRefToProcVar */,rtl.tTypeInfoProcVar);

    // member kinds
    rtl.tTypeMember = { attr: null };
    function newMember(name,kind){
      var m = Object.create(rtl.tTypeMember);
      m.name = name;
      m.kind = kind;
      rtl[name] = m;
    };
    newMember("tTypeMemberField",1); // tmkField
    newMember("tTypeMemberMethod",2); // tmkMethod
    newMember("tTypeMemberProperty",3); // tmkProperty

    // base object for storing members: a simple object
    rtl.tTypeMembers = {};

    // tTypeInfoStruct - base object for tTypeInfoClass, tTypeInfoRecord, tTypeInfoInterface
    var tis = newBaseTI("tTypeInfoStruct",0);
    tis.$addMember = function(name,ancestor,options){
      if (rtl.debug_rtti){
        if (!rtl.hasString(name) || (name.charAt()==='$')) throw 'invalid member "'+name+'", this="'+this.name+'"';
        if (!rtl.is(ancestor,rtl.tTypeMember)) throw 'invalid ancestor "'+ancestor+':'+ancestor.name+'", "'+this.name+'.'+name+'"';
        if ((options!=undefined) && (typeof(options)!='object')) throw 'invalid options "'+options+'", "'+this.name+'.'+name+'"';
      };
      var t = Object.create(ancestor);
      t.name = name;
      this.members[name] = t;
      this.names.push(name);
      if (rtl.isObject(options)){
        for (var key in options) if (options.hasOwnProperty(key)) t[key] = options[key];
      };
      return t;
    };
    tis.addField = function(name,type,options){
      var t = this.$addMember(name,rtl.tTypeMemberField,options);
      if (rtl.debug_rtti){
        if (!rtl.is(type,rtl.tTypeInfo)) throw 'invalid type "'+type+'", "'+this.name+'.'+name+'"';
      };
      t.typeinfo = type;
      this.fields.push(name);
      return t;
    };
    tis.addFields = function(){
      var i=0;
      while(i<arguments.length){
        var name = arguments[i++];
        var type = arguments[i++];
        if ((i<arguments.length) && (typeof(arguments[i])==='object')){
          this.addField(name,type,arguments[i++]);
        } else {
          this.addField(name,type);
        };
      };
    };
    tis.addMethod = function(name,methodkind,params,result,flags,options){
      var t = this.$addMember(name,rtl.tTypeMemberMethod,options);
      t.methodkind = methodkind;
      t.procsig = rtl.newTIProcSig(params,result,flags);
      this.methods.push(name);
      return t;
    };
    tis.addProperty = function(name,flags,result,getter,setter,options){
      var t = this.$addMember(name,rtl.tTypeMemberProperty,options);
      t.flags = flags;
      t.typeinfo = result;
      t.getter = getter;
      t.setter = setter;
      // Note: in options: params, stored, defaultvalue
      t.params = rtl.isArray(t.params) ? rtl.newTIParams(t.params) : null;
      this.properties.push(name);
      if (!rtl.isString(t.stored)) t.stored = "";
      return t;
    };
    tis.getField = function(index){
      return this.members[this.fields[index]];
    };
    tis.getMethod = function(index){
      return this.members[this.methods[index]];
    };
    tis.getProperty = function(index){
      return this.members[this.properties[index]];
    };

    newBaseTI("tTypeInfoRecord",12 /* tkRecord */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoClass",13 /* tkClass */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoClassRef",14 /* tkClassRef */);
    newBaseTI("tTypeInfoInterface",18 /* tkInterface */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoHelper",19 /* tkHelper */,rtl.tTypeInfoStruct);
    newBaseTI("tTypeInfoExtClass",20 /* tkExtClass */,rtl.tTypeInfoClass);
  },

  tSectionRTTI: {
    $module: null,
    $inherited: function(name,ancestor,o){
      if (rtl.debug_rtti){
        rtl.debug('tSectionRTTI.newTI "'+(this.$module?this.$module.$name:"(no module)")
          +'"."'+name+'" ('+ancestor.name+') '+(o?'init':'forward'));
      };
      var t = this[name];
      if (t){
        if (!t.$forward) throw 'duplicate type "'+name+'"';
        if (!ancestor.isPrototypeOf(t)) throw 'typeinfo ancestor mismatch "'+name+'" ancestor="'+ancestor.name+'" t.name="'+t.name+'"';
      } else {
        t = Object.create(ancestor);
        t.name = name;
        t.$module = this.$module;
        this[name] = t;
      }
      if (o){
        delete t.$forward;
        for (var key in o) if (o.hasOwnProperty(key)) t[key]=o[key];
      } else {
        t.$forward = true;
      }
      return t;
    },
    $Scope: function(name,ancestor,o){
      var t=this.$inherited(name,ancestor,o);
      t.members = {};
      t.names = [];
      t.fields = [];
      t.methods = [];
      t.properties = [];
      return t;
    },
    $TI: function(name,kind,o){ var t=this.$inherited(name,rtl.tTypeInfo,o); t.kind = kind; return t; },
    $Int: function(name,o){ return this.$inherited(name,rtl.tTypeInfoInteger,o); },
    $Enum: function(name,o){ return this.$inherited(name,rtl.tTypeInfoEnum,o); },
    $Set: function(name,o){ return this.$inherited(name,rtl.tTypeInfoSet,o); },
    $StaticArray: function(name,o){ return this.$inherited(name,rtl.tTypeInfoArray,o); },
    $DynArray: function(name,o){ return this.$inherited(name,rtl.tTypeInfoDynArray,o); },
    $ProcVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoProcVar,o); },
    $RefToProcVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoRefToProcVar,o); },
    $MethodVar: function(name,o){ return this.$inherited(name,rtl.tTypeInfoMethodVar,o); },
    $Record: function(name,o){ return this.$Scope(name,rtl.tTypeInfoRecord,o); },
    $Class: function(name,o){ return this.$Scope(name,rtl.tTypeInfoClass,o); },
    $ClassRef: function(name,o){ return this.$inherited(name,rtl.tTypeInfoClassRef,o); },
    $Pointer: function(name,o){ return this.$inherited(name,rtl.tTypeInfoPointer,o); },
    $Interface: function(name,o){ return this.$Scope(name,rtl.tTypeInfoInterface,o); },
    $Helper: function(name,o){ return this.$Scope(name,rtl.tTypeInfoHelper,o); },
    $ExtClass: function(name,o){ return this.$Scope(name,rtl.tTypeInfoExtClass,o); }
  },

  newTIParam: function(param){
    // param is an array, 0=name, 1=type, 2=optional flags
    var t = {
      name: param[0],
      typeinfo: param[1],
      flags: (rtl.isNumber(param[2]) ? param[2] : 0)
    };
    return t;
  },

  newTIParams: function(list){
    // list: optional array of [paramname,typeinfo,optional flags]
    var params = [];
    if (rtl.isArray(list)){
      for (var i=0; i<list.length; i++) params.push(rtl.newTIParam(list[i]));
    };
    return params;
  },

  newTIProcSig: function(params,result,flags){
    var s = {
      params: rtl.newTIParams(params),
      resulttype: result?result:null,
      flags: flags?flags:0
    };
    return s;
  },

  addResource: function(aRes){
    rtl.$res[aRes.name]=aRes;
  },

  getResource: function(aName){
    var res = rtl.$res[aName];
    if (res !== undefined) {
      return res;
    } else {
      return null;
    }
  },

  getResourceList: function(){
    return Object.keys(rtl.$res);
  }
}

rtl.module("System",[],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass(this,"TObject",null,function () {
    this.$init = function () {
    };
    this.$final = function () {
    };
    this.Create = function () {
      return this;
    };
    this.Destroy = function () {
    };
    this.Free = function () {
      this.$destroy("Destroy");
    };
    this.AfterConstruction = function () {
    };
    this.BeforeDestruction = function () {
    };
  });
  this.vtInteger = 0;
  this.vtExtended = 3;
  this.vtWideChar = 9;
  this.vtCurrency = 12;
  this.vtUnicodeString = 18;
  this.vtNativeInt = 19;
  rtl.recNewT(this,"TVarRec",function () {
    this.VType = 0;
    this.VJSValue = undefined;
    this.$eq = function (b) {
      return (this.VType === b.VType) && (this.VJSValue === b.VJSValue) && (this.VJSValue === b.VJSValue) && (this.VJSValue === b.VJSValue) && (this.VJSValue === b.VJSValue) && (this.VJSValue === b.VJSValue) && (this.VJSValue === b.VJSValue) && (this.VJSValue === b.VJSValue);
    };
    this.$assign = function (s) {
      this.VType = s.VType;
      this.VJSValue = s.VJSValue;
      this.VJSValue = s.VJSValue;
      this.VJSValue = s.VJSValue;
      this.VJSValue = s.VJSValue;
      this.VJSValue = s.VJSValue;
      this.VJSValue = s.VJSValue;
      this.VJSValue = s.VJSValue;
      return this;
    };
  });
  this.VarRecs = function () {
    var Result = [];
    var i = 0;
    var v = null;
    Result = [];
    while (i < arguments.length) {
      v = $mod.TVarRec.$new();
      v.VType = rtl.trunc(arguments[i]);
      i += 1;
      v.VJSValue = arguments[i];
      i += 1;
      Result.push($mod.TVarRec.$clone(v));
    };
    return Result;
  };
  this.Random = function (Range) {
    return Math.floor(Math.random()*Range);
  };
  this.Sqr = function (A) {
    return A*A;
  };
  this.Sqr$1 = function (A) {
    return A*A;
  };
  this.Trunc = function (A) {
    if (!Math.trunc) {
      Math.trunc = function(v) {
        v = +v;
        if (!isFinite(v)) return v;
        return (v - v % 1) || (v < 0 ? -0 : v === 0 ? v : 0);
      };
    }
    $mod.Trunc = Math.trunc;
    return Math.trunc(A);
  };
  this.Int = function (A) {
    var Result = 0.0;
    Result = $mod.Trunc(A);
    return Result;
  };
  this.Copy = function (S, Index, Size) {
    if (Index<1) Index = 1;
    return (Size>0) ? S.substring(Index-1,Index+Size-1) : "";
  };
  this.Copy$1 = function (S, Index) {
    if (Index<1) Index = 1;
    return S.substr(Index-1);
  };
  this.Delete = function (S, Index, Size) {
    var h = "";
    if ((Index < 1) || (Index > S.get().length) || (Size <= 0)) return;
    h = S.get();
    S.set($mod.Copy(h,1,Index - 1) + $mod.Copy$1(h,Index + Size));
  };
  this.Pos = function (Search, InString) {
    return InString.indexOf(Search)+1;
  };
  this.Insert = function (Insertion, Target, Index) {
    var t = "";
    if (Insertion === "") return;
    t = Target.get();
    if (Index < 1) {
      Target.set(Insertion + t)}
     else if (Index > t.length) {
      Target.set(t + Insertion)}
     else Target.set($mod.Copy(t,1,Index - 1) + Insertion + $mod.Copy(t,Index,t.length));
  };
  this.upcase = function (c) {
    return c.toUpperCase();
  };
  this.val = function (S, NI, Code) {
    NI.set($impl.valint(S,-9007199254740991,9007199254740991,Code));
  };
  this.StringOfChar = function (c, l) {
    var Result = "";
    var i = 0;
    if ((l>0) && c.repeat) return c.repeat(l);
    Result = "";
    for (var $l = 1, $end = l; $l <= $end; $l++) {
      i = $l;
      Result = Result + c;
    };
    return Result;
  };
  this.Writeln = function () {
    var i = 0;
    var l = 0;
    var s = "";
    l = arguments.length - 1;
    if ($impl.WriteCallBack != null) {
      for (var $l = 0, $end = l; $l <= $end; $l++) {
        i = $l;
        $impl.WriteCallBack(arguments[i],i === l);
      };
    } else {
      s = $impl.WriteBuf;
      for (var $l1 = 0, $end1 = l; $l1 <= $end1; $l1++) {
        i = $l1;
        s = s + ("" + arguments[i]);
      };
      console.log(s);
      $impl.WriteBuf = "";
    };
  };
  this.Assigned = function (V) {
    return (V!=undefined) && (V!=null) && (!rtl.isArray(V) || (V.length > 0));
  };
  $mod.$implcode = function () {
    $impl.WriteBuf = "";
    $impl.WriteCallBack = null;
    $impl.valint = function (S, MinVal, MaxVal, Code) {
      var Result = 0;
      var x = 0.0;
      if (S === "") {
        Code.set(1);
        return Result;
      };
      x = Number(S);
      if (isNaN(x)) {
        var $tmp = $mod.Copy(S,1,1);
        if ($tmp === "$") {
          x = Number("0x" + $mod.Copy$1(S,2))}
         else if ($tmp === "&") {
          x = Number("0o" + $mod.Copy$1(S,2))}
         else if ($tmp === "%") {
          x = Number("0b" + $mod.Copy$1(S,2))}
         else {
          Code.set(1);
          return Result;
        };
      };
      if (isNaN(x) || (x !== $mod.Int(x))) {
        Code.set(1)}
       else if ((x < MinVal) || (x > MaxVal)) {
        Code.set(2)}
       else {
        Result = $mod.Trunc(x);
        Code.set(0);
      };
      return Result;
    };
  };
  $mod.$init = function () {
    rtl.exitcode = 0;
  };
},[]);
rtl.module("Math",["System"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("Types",["System"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("JS",["System","Types"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("Web",["System","Types","JS"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("webgl",["System","JS","Web"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("RTLConsts",["System"],function () {
  "use strict";
  var $mod = this;
  $mod.$resourcestrings = {SArgumentMissing: {org: 'Missing argument in format "%s"'}, SInvalidFormat: {org: 'Invalid format specifier : "%s"'}, SInvalidArgIndex: {org: 'Invalid argument index in format: "%s"'}, SListCapacityError: {org: "List capacity (%s) exceeded."}, SListCountError: {org: "List count (%s) out of bounds."}, SListIndexError: {org: "List index (%s) out of bounds"}, SErrInvalidInteger: {org: 'Invalid integer value: "%s"'}};
});
rtl.module("SysUtils",["System","RTLConsts","JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.FreeAndNil = function (Obj) {
    var o = null;
    o = Obj.get();
    if (o === null) return;
    Obj.set(null);
    o.$destroy("Destroy");
  };
  rtl.recNewT(this,"TFormatSettings",function () {
    this.CurrencyDecimals = 0;
    this.CurrencyFormat = 0;
    this.CurrencyString = "";
    this.DateSeparator = "";
    this.DecimalSeparator = "";
    this.LongDateFormat = "";
    this.LongTimeFormat = "";
    this.NegCurrFormat = 0;
    this.ShortDateFormat = "";
    this.ShortTimeFormat = "";
    this.ThousandSeparator = "";
    this.TimeAMString = "";
    this.TimePMString = "";
    this.TimeSeparator = "";
    this.TwoDigitYearCenturyWindow = 0;
    this.InitLocaleHandler = null;
    this.$new = function () {
      var r = Object.create(this);
      r.DateTimeToStrFormat = rtl.arraySetLength(null,"",2);
      r.LongDayNames = rtl.arraySetLength(null,"",7);
      r.LongMonthNames = rtl.arraySetLength(null,"",12);
      r.ShortDayNames = rtl.arraySetLength(null,"",7);
      r.ShortMonthNames = rtl.arraySetLength(null,"",12);
      return r;
    };
    this.$eq = function (b) {
      return (this.CurrencyDecimals === b.CurrencyDecimals) && (this.CurrencyFormat === b.CurrencyFormat) && (this.CurrencyString === b.CurrencyString) && (this.DateSeparator === b.DateSeparator) && rtl.arrayEq(this.DateTimeToStrFormat,b.DateTimeToStrFormat) && (this.DecimalSeparator === b.DecimalSeparator) && (this.LongDateFormat === b.LongDateFormat) && rtl.arrayEq(this.LongDayNames,b.LongDayNames) && rtl.arrayEq(this.LongMonthNames,b.LongMonthNames) && (this.LongTimeFormat === b.LongTimeFormat) && (this.NegCurrFormat === b.NegCurrFormat) && (this.ShortDateFormat === b.ShortDateFormat) && rtl.arrayEq(this.ShortDayNames,b.ShortDayNames) && rtl.arrayEq(this.ShortMonthNames,b.ShortMonthNames) && (this.ShortTimeFormat === b.ShortTimeFormat) && (this.ThousandSeparator === b.ThousandSeparator) && (this.TimeAMString === b.TimeAMString) && (this.TimePMString === b.TimePMString) && (this.TimeSeparator === b.TimeSeparator) && (this.TwoDigitYearCenturyWindow === b.TwoDigitYearCenturyWindow);
    };
    this.$assign = function (s) {
      this.CurrencyDecimals = s.CurrencyDecimals;
      this.CurrencyFormat = s.CurrencyFormat;
      this.CurrencyString = s.CurrencyString;
      this.DateSeparator = s.DateSeparator;
      this.DateTimeToStrFormat = s.DateTimeToStrFormat.slice(0);
      this.DecimalSeparator = s.DecimalSeparator;
      this.LongDateFormat = s.LongDateFormat;
      this.LongDayNames = s.LongDayNames.slice(0);
      this.LongMonthNames = s.LongMonthNames.slice(0);
      this.LongTimeFormat = s.LongTimeFormat;
      this.NegCurrFormat = s.NegCurrFormat;
      this.ShortDateFormat = s.ShortDateFormat;
      this.ShortDayNames = s.ShortDayNames.slice(0);
      this.ShortMonthNames = s.ShortMonthNames.slice(0);
      this.ShortTimeFormat = s.ShortTimeFormat;
      this.ThousandSeparator = s.ThousandSeparator;
      this.TimeAMString = s.TimeAMString;
      this.TimePMString = s.TimePMString;
      this.TimeSeparator = s.TimeSeparator;
      this.TwoDigitYearCenturyWindow = s.TwoDigitYearCenturyWindow;
      return this;
    };
    this.GetJSLocale = function () {
      return Intl.DateTimeFormat().resolvedOptions().locale;
    };
    this.Create = function () {
      var Result = $mod.TFormatSettings.$new();
      Result.$assign($mod.TFormatSettings.Create$1($mod.TFormatSettings.GetJSLocale()));
      return Result;
    };
    this.Create$1 = function (ALocale) {
      var Result = $mod.TFormatSettings.$new();
      Result.LongDayNames = $impl.DefaultLongDayNames.slice(0);
      Result.ShortDayNames = $impl.DefaultShortDayNames.slice(0);
      Result.ShortMonthNames = $impl.DefaultShortMonthNames.slice(0);
      Result.LongMonthNames = $impl.DefaultLongMonthNames.slice(0);
      Result.DateTimeToStrFormat[0] = "c";
      Result.DateTimeToStrFormat[1] = "f";
      Result.DateSeparator = "-";
      Result.TimeSeparator = ":";
      Result.ShortDateFormat = "yyyy-mm-dd";
      Result.LongDateFormat = "ddd, yyyy-mm-dd";
      Result.ShortTimeFormat = "hh:nn";
      Result.LongTimeFormat = "hh:nn:ss";
      Result.DecimalSeparator = ".";
      Result.ThousandSeparator = ",";
      Result.TimeAMString = "AM";
      Result.TimePMString = "PM";
      Result.TwoDigitYearCenturyWindow = 50;
      Result.CurrencyFormat = 0;
      Result.NegCurrFormat = 0;
      Result.CurrencyDecimals = 2;
      Result.CurrencyString = "$";
      if ($mod.TFormatSettings.InitLocaleHandler != null) $mod.TFormatSettings.InitLocaleHandler($mod.UpperCase(ALocale),$mod.TFormatSettings.$clone(Result));
      return Result;
    };
  },true);
  rtl.createClass(this,"Exception",pas.System.TObject,function () {
    this.LogMessageOnCreate = false;
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fMessage = "";
    };
    this.Create$1 = function (Msg) {
      this.fMessage = Msg;
      if (this.LogMessageOnCreate) pas.System.Writeln("Created exception ",this.$classname," with message: ",Msg);
      return this;
    };
    this.CreateFmt = function (Msg, Args) {
      this.Create$1($mod.Format(Msg,Args));
      return this;
    };
  });
  rtl.createClass(this,"EConvertError",this.Exception,function () {
  });
  this.TrimLeft = function (S) {
    return S.replace(/^[\s\uFEFF\xA0\x00-\x1f]+/,'');
  };
  this.UpperCase = function (s) {
    return s.toUpperCase();
  };
  this.LowerCase = function (s) {
    return s.toLowerCase();
  };
  this.Format = function (Fmt, Args) {
    var Result = "";
    Result = $mod.Format$1(Fmt,Args,$mod.FormatSettings);
    return Result;
  };
  this.Format$1 = function (Fmt, Args, aSettings) {
    var Result = "";
    var ChPos = 0;
    var OldPos = 0;
    var ArgPos = 0;
    var DoArg = 0;
    var Len = 0;
    var Hs = "";
    var ToAdd = "";
    var Index = 0;
    var Width = 0;
    var Prec = 0;
    var Left = false;
    var Fchar = "";
    var vq = 0;
    function ReadFormat() {
      var Result = "";
      var Value = 0;
      function ReadInteger() {
        var Code = 0;
        var ArgN = 0;
        if (Value !== -1) return;
        OldPos = ChPos;
        while ((ChPos <= Len) && (Fmt.charAt(ChPos - 1) <= "9") && (Fmt.charAt(ChPos - 1) >= "0")) ChPos += 1;
        if (ChPos > Len) $impl.DoFormatError(1,Fmt);
        if (Fmt.charAt(ChPos - 1) === "*") {
          if (Index === 255) {
            ArgN = ArgPos}
           else {
            ArgN = Index;
            Index += 1;
          };
          if ((ChPos > OldPos) || (ArgN > (rtl.length(Args) - 1))) $impl.DoFormatError(1,Fmt);
          ArgPos = ArgN + 1;
          var $tmp = Args[ArgN].VType;
          if ($tmp === 0) {
            Value = Args[ArgN].VJSValue}
           else if ($tmp === 19) {
            Value = Args[ArgN].VJSValue}
           else {
            $impl.DoFormatError(1,Fmt);
          };
          ChPos += 1;
        } else {
          if (OldPos < ChPos) {
            pas.System.val(pas.System.Copy(Fmt,OldPos,ChPos - OldPos),{get: function () {
                return Value;
              }, set: function (v) {
                Value = v;
              }},{get: function () {
                return Code;
              }, set: function (v) {
                Code = v;
              }});
            if (Code > 0) $impl.DoFormatError(1,Fmt);
          } else Value = -1;
        };
      };
      function ReadIndex() {
        if (Fmt.charAt(ChPos - 1) !== ":") {
          ReadInteger()}
         else Value = 0;
        if (Fmt.charAt(ChPos - 1) === ":") {
          if (Value === -1) $impl.DoFormatError(2,Fmt);
          Index = Value;
          Value = -1;
          ChPos += 1;
        };
      };
      function ReadLeft() {
        if (Fmt.charAt(ChPos - 1) === "-") {
          Left = true;
          ChPos += 1;
        } else Left = false;
      };
      function ReadWidth() {
        ReadInteger();
        if (Value !== -1) {
          Width = Value;
          Value = -1;
        };
      };
      function ReadPrec() {
        if (Fmt.charAt(ChPos - 1) === ".") {
          ChPos += 1;
          ReadInteger();
          if (Value === -1) Value = 0;
          Prec = Value;
        };
      };
      Index = 255;
      Width = -1;
      Prec = -1;
      Value = -1;
      ChPos += 1;
      if (Fmt.charAt(ChPos - 1) === "%") {
        Result = "%";
        return Result;
      };
      ReadIndex();
      ReadLeft();
      ReadWidth();
      ReadPrec();
      Result = pas.System.upcase(Fmt.charAt(ChPos - 1));
      return Result;
    };
    function Checkarg(AT, err) {
      var Result = false;
      Result = false;
      if (Index === 255) {
        DoArg = ArgPos}
       else DoArg = Index;
      ArgPos = DoArg + 1;
      if ((DoArg > (rtl.length(Args) - 1)) || (Args[DoArg].VType !== AT)) {
        if (err) $impl.DoFormatError(3,Fmt);
        ArgPos -= 1;
        return Result;
      };
      Result = true;
      return Result;
    };
    Result = "";
    Len = Fmt.length;
    ChPos = 1;
    OldPos = 1;
    ArgPos = 0;
    while (ChPos <= Len) {
      while ((ChPos <= Len) && (Fmt.charAt(ChPos - 1) !== "%")) ChPos += 1;
      if (ChPos > OldPos) Result = Result + pas.System.Copy(Fmt,OldPos,ChPos - OldPos);
      if (ChPos < Len) {
        Fchar = ReadFormat();
        var $tmp = Fchar;
        if ($tmp === "D") {
          if (Checkarg(0,false)) {
            ToAdd = $mod.IntToStr(Args[DoArg].VJSValue)}
           else if (Checkarg(19,true)) ToAdd = $mod.IntToStr(Args[DoArg].VJSValue);
          Width = Math.abs(Width);
          Index = Prec - ToAdd.length;
          if (ToAdd.charAt(0) !== "-") {
            ToAdd = pas.System.StringOfChar("0",Index) + ToAdd}
           else pas.System.Insert(pas.System.StringOfChar("0",Index + 1),{get: function () {
              return ToAdd;
            }, set: function (v) {
              ToAdd = v;
            }},2);
        } else if ($tmp === "U") {
          if (Checkarg(0,false)) {
            ToAdd = $mod.IntToStr(Args[DoArg].VJSValue >>> 0)}
           else if (Checkarg(19,true)) ToAdd = $mod.IntToStr(Args[DoArg].VJSValue);
          Width = Math.abs(Width);
          Index = Prec - ToAdd.length;
          ToAdd = pas.System.StringOfChar("0",Index) + ToAdd;
        } else if ($tmp === "E") {
          if (Checkarg(12,false)) {
            ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue / 10000,2,3,Prec,aSettings)}
           else if (Checkarg(3,true)) ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue,2,3,Prec,aSettings);
        } else if ($tmp === "F") {
          if (Checkarg(12,false)) {
            ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue / 10000,0,9999,Prec,aSettings)}
           else if (Checkarg(3,true)) ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue,0,9999,Prec,aSettings);
        } else if ($tmp === "G") {
          if (Checkarg(12,false)) {
            ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue / 10000,1,Prec,3,aSettings)}
           else if (Checkarg(3,true)) ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue,1,Prec,3,aSettings);
        } else if ($tmp === "N") {
          if (Checkarg(12,false)) {
            ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue / 10000,3,9999,Prec,aSettings)}
           else if (Checkarg(3,true)) ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue,3,9999,Prec,aSettings);
        } else if ($tmp === "M") {
          if (Checkarg(12,false)) {
            ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue / 10000,4,9999,Prec,aSettings)}
           else if (Checkarg(3,true)) ToAdd = $mod.FloatToStrF$1(Args[DoArg].VJSValue,4,9999,Prec,aSettings);
        } else if ($tmp === "S") {
          if (Checkarg(18,false)) {
            Hs = Args[DoArg].VJSValue}
           else if (Checkarg(9,true)) Hs = Args[DoArg].VJSValue;
          Index = Hs.length;
          if ((Prec !== -1) && (Index > Prec)) Index = Prec;
          ToAdd = pas.System.Copy(Hs,1,Index);
        } else if ($tmp === "P") {
          if (Checkarg(0,false)) {
            ToAdd = $mod.IntToHex(Args[DoArg].VJSValue,8)}
           else if (Checkarg(0,true)) ToAdd = $mod.IntToHex(Args[DoArg].VJSValue,16);
        } else if ($tmp === "X") {
          if (Checkarg(0,false)) {
            vq = Args[DoArg].VJSValue;
            Index = 16;
          } else if (Checkarg(19,true)) {
            vq = Args[DoArg].VJSValue;
            Index = 31;
          };
          if (Prec > Index) {
            ToAdd = $mod.IntToHex(vq,Index)}
           else {
            Index = 1;
            while ((rtl.shl(1,Index * 4) <= vq) && (Index < 16)) Index += 1;
            if (Index > Prec) Prec = Index;
            ToAdd = $mod.IntToHex(vq,Prec);
          };
        } else if ($tmp === "%") ToAdd = "%";
        if (Width !== -1) if (ToAdd.length < Width) if (!Left) {
          ToAdd = pas.System.StringOfChar(" ",Width - ToAdd.length) + ToAdd}
         else ToAdd = ToAdd + pas.System.StringOfChar(" ",Width - ToAdd.length);
        Result = Result + ToAdd;
      };
      ChPos += 1;
      OldPos = ChPos;
    };
    return Result;
  };
  this.IntToStr = function (Value) {
    var Result = "";
    Result = "" + Value;
    return Result;
  };
  this.TryStrToInt$1 = function (S, res) {
    var Result = false;
    Result = $impl.IntTryStrToInt(S,res,$mod.FormatSettings.DecimalSeparator);
    return Result;
  };
  this.StrToInt = function (S) {
    var Result = 0;
    var R = 0;
    if (!$mod.TryStrToInt$1(S,{get: function () {
        return R;
      }, set: function (v) {
        R = v;
      }})) throw $mod.EConvertError.$create("CreateFmt",[rtl.getResStr(pas.RTLConsts,"SErrInvalidInteger"),pas.System.VarRecs(18,S)]);
    Result = R;
    return Result;
  };
  this.IntToHex = function (Value, Digits) {
    var Result = "";
    Result = "";
    if (Value < 0) if (Value<0) Value = 0xFFFFFFFF + Value + 1;
    Result=Value.toString(16);
    Result = $mod.UpperCase(Result);
    while (Result.length < Digits) Result = "0" + Result;
    return Result;
  };
  this.TFloatFormat = {"0": "ffFixed", ffFixed: 0, "1": "ffGeneral", ffGeneral: 1, "2": "ffExponent", ffExponent: 2, "3": "ffNumber", ffNumber: 3, "4": "ffCurrency", ffCurrency: 4};
  this.FloatToStrF$1 = function (Value, format, Precision, Digits, aSettings) {
    var Result = "";
    var TS = "";
    var DS = "";
    DS = aSettings.DecimalSeparator;
    TS = aSettings.ThousandSeparator;
    var $tmp = format;
    if ($tmp === 1) {
      Result = $impl.FormatGeneralFloat(Value,Precision,DS)}
     else if ($tmp === 2) {
      Result = $impl.FormatExponentFloat(Value,Precision,Digits,DS)}
     else if ($tmp === 0) {
      Result = $impl.FormatFixedFloat(Value,Digits,DS)}
     else if ($tmp === 3) {
      Result = $impl.FormatNumberFloat(Value,Digits,DS,TS)}
     else if ($tmp === 4) Result = $impl.FormatNumberCurrency(Value * 10000,Digits,aSettings);
    if ((format !== 4) && (Result.length > 1) && (Result.charAt(0) === "-")) $impl.RemoveLeadingNegativeSign({get: function () {
        return Result;
      }, set: function (v) {
        Result = v;
      }},DS,TS);
    return Result;
  };
  this.TimeSeparator = "";
  this.DateSeparator = "";
  this.ShortDateFormat = "";
  this.LongDateFormat = "";
  this.ShortTimeFormat = "";
  this.LongTimeFormat = "";
  this.DecimalSeparator = "";
  this.ThousandSeparator = "";
  this.TimeAMString = "";
  this.TimePMString = "";
  this.ShortMonthNames = rtl.arraySetLength(null,"",12);
  this.LongMonthNames = rtl.arraySetLength(null,"",12);
  this.ShortDayNames = rtl.arraySetLength(null,"",7);
  this.LongDayNames = rtl.arraySetLength(null,"",7);
  this.FormatSettings = this.TFormatSettings.$new();
  this.CurrencyFormat = 0;
  this.NegCurrFormat = 0;
  this.CurrencyDecimals = 0;
  this.CurrencyString = "";
  $mod.$implcode = function () {
    $impl.DefaultShortMonthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    $impl.DefaultLongMonthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    $impl.DefaultShortDayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    $impl.DefaultLongDayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    $impl.feInvalidFormat = 1;
    $impl.feMissingArgument = 2;
    $impl.feInvalidArgIndex = 3;
    $impl.DoFormatError = function (ErrCode, fmt) {
      var $tmp = ErrCode;
      if ($tmp === 1) {
        throw $mod.EConvertError.$create("CreateFmt",[rtl.getResStr(pas.RTLConsts,"SInvalidFormat"),pas.System.VarRecs(18,fmt)])}
       else if ($tmp === 2) {
        throw $mod.EConvertError.$create("CreateFmt",[rtl.getResStr(pas.RTLConsts,"SArgumentMissing"),pas.System.VarRecs(18,fmt)])}
       else if ($tmp === 3) throw $mod.EConvertError.$create("CreateFmt",[rtl.getResStr(pas.RTLConsts,"SInvalidArgIndex"),pas.System.VarRecs(18,fmt)]);
    };
    $impl.maxdigits = 15;
    $impl.ReplaceDecimalSep = function (S, DS) {
      var Result = "";
      var P = 0;
      P = pas.System.Pos(".",S);
      if (P > 0) {
        Result = pas.System.Copy(S,1,P - 1) + DS + pas.System.Copy(S,P + 1,S.length - P)}
       else Result = S;
      return Result;
    };
    $impl.FormatGeneralFloat = function (Value, Precision, DS) {
      var Result = "";
      var P = 0;
      var PE = 0;
      var Q = 0;
      var Exponent = 0;
      if ((Precision === -1) || (Precision > 15)) Precision = 15;
      Result = rtl.floatToStr(Value,Precision + 7);
      Result = $mod.TrimLeft(Result);
      P = pas.System.Pos(".",Result);
      if (P === 0) return Result;
      PE = pas.System.Pos("E",Result);
      if (PE === 0) {
        Result = $impl.ReplaceDecimalSep(Result,DS);
        return Result;
      };
      Q = PE + 2;
      Exponent = 0;
      while (Q <= Result.length) {
        Exponent = ((Exponent * 10) + Result.charCodeAt(Q - 1)) - 48;
        Q += 1;
      };
      if (Result.charAt((PE + 1) - 1) === "-") Exponent = -Exponent;
      if (((P + Exponent) < PE) && (Exponent > -6)) {
        Result = rtl.strSetLength(Result,PE - 1);
        if (Exponent >= 0) {
          for (var $l = 0, $end = Exponent - 1; $l <= $end; $l++) {
            Q = $l;
            Result = rtl.setCharAt(Result,P - 1,Result.charAt((P + 1) - 1));
            P += 1;
          };
          Result = rtl.setCharAt(Result,P - 1,".");
          P = 1;
          if (Result.charAt(P - 1) === "-") P += 1;
          while ((Result.charAt(P - 1) === "0") && (P < Result.length) && (pas.System.Copy(Result,P + 1,DS.length) !== DS)) pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},P,1);
        } else {
          pas.System.Insert(pas.System.Copy("00000",1,-Exponent),{get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},P - 1);
          Result = rtl.setCharAt(Result,P - Exponent - 1,Result.charAt(P - Exponent - 1 - 1));
          Result = rtl.setCharAt(Result,P - 1,".");
          if (Exponent !== -1) Result = rtl.setCharAt(Result,P - Exponent - 1 - 1,"0");
        };
        Q = Result.length;
        while ((Q > 0) && (Result.charAt(Q - 1) === "0")) Q -= 1;
        if (Result.charAt(Q - 1) === ".") Q -= 1;
        if ((Q === 0) || ((Q === 1) && (Result.charAt(0) === "-"))) {
          Result = "0"}
         else Result = rtl.strSetLength(Result,Q);
      } else {
        while (Result.charAt(PE - 1 - 1) === "0") {
          pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},PE - 1,1);
          PE -= 1;
        };
        if (Result.charAt(PE - 1 - 1) === DS) {
          pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},PE - 1,1);
          PE -= 1;
        };
        if (Result.charAt((PE + 1) - 1) === "+") {
          pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},PE + 1,1)}
         else PE += 1;
        while (Result.charAt((PE + 1) - 1) === "0") pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},PE + 1,1);
      };
      Result = $impl.ReplaceDecimalSep(Result,DS);
      return Result;
    };
    $impl.FormatExponentFloat = function (Value, Precision, Digits, DS) {
      var Result = "";
      var P = 0;
      DS = $mod.FormatSettings.DecimalSeparator;
      if ((Precision === -1) || (Precision > 15)) Precision = 15;
      Result = rtl.floatToStr(Value,Precision + 7);
      while (Result.charAt(0) === " ") pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},1,1);
      P = pas.System.Pos("E",Result);
      if (P === 0) {
        Result = $impl.ReplaceDecimalSep(Result,DS);
        return Result;
      };
      P += 2;
      if (Digits > 4) Digits = 4;
      Digits = (Result.length - P - Digits) + 1;
      if (Digits < 0) {
        pas.System.Insert(pas.System.Copy("0000",1,-Digits),{get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P)}
       else while ((Digits > 0) && (Result.charAt(P - 1) === "0")) {
        pas.System.Delete({get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P,1);
        if (P > Result.length) {
          pas.System.Delete({get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},P - 2,2);
          break;
        };
        Digits -= 1;
      };
      Result = $impl.ReplaceDecimalSep(Result,DS);
      return Result;
    };
    $impl.FormatFixedFloat = function (Value, Digits, DS) {
      var Result = "";
      if (Digits === -1) {
        Digits = 2}
       else if (Digits > 18) Digits = 18;
      Result = rtl.floatToStr(Value,0,Digits);
      if ((Result !== "") && (Result.charAt(0) === " ")) pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},1,1);
      Result = $impl.ReplaceDecimalSep(Result,DS);
      return Result;
    };
    $impl.FormatNumberFloat = function (Value, Digits, DS, TS) {
      var Result = "";
      var P = 0;
      if (Digits === -1) {
        Digits = 2}
       else if (Digits > 15) Digits = 15;
      Result = rtl.floatToStr(Value,0,Digits);
      if ((Result !== "") && (Result.charAt(0) === " ")) pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},1,1);
      P = pas.System.Pos(".",Result);
      if (P <= 0) P = Result.length + 1;
      Result = $impl.ReplaceDecimalSep(Result,DS);
      P -= 3;
      if ((TS !== "") && (TS !== "\x00")) while (P > 1) {
        if (Result.charAt(P - 1 - 1) !== "-") pas.System.Insert(TS,{get: function () {
            return Result;
          }, set: function (v) {
            Result = v;
          }},P);
        P -= 3;
      };
      return Result;
    };
    $impl.RemoveLeadingNegativeSign = function (AValue, DS, aThousandSeparator) {
      var Result = false;
      var i = 0;
      var TS = "";
      var StartPos = 0;
      Result = false;
      StartPos = 2;
      TS = aThousandSeparator;
      for (var $l = StartPos, $end = AValue.get().length; $l <= $end; $l++) {
        i = $l;
        Result = (AValue.get().charCodeAt(i - 1) in rtl.createSet(48,DS.charCodeAt(),69,43)) || (AValue.get().charAt(i - 1) === TS);
        if (!Result) break;
      };
      if (Result && (AValue.get().charAt(0) === "-")) pas.System.Delete(AValue,1,1);
      return Result;
    };
    $impl.FormatNumberCurrency = function (Value, Digits, aSettings) {
      var Result = "";
      var Negative = false;
      var P = 0;
      var CS = "";
      var DS = "";
      var TS = "";
      DS = aSettings.DecimalSeparator;
      TS = aSettings.ThousandSeparator;
      CS = aSettings.CurrencyString;
      if (Digits === -1) {
        Digits = aSettings.CurrencyDecimals}
       else if (Digits > 18) Digits = 18;
      Result = rtl.floatToStr(Value / 10000,0,Digits);
      Negative = Result.charAt(0) === "-";
      if (Negative) pas.System.Delete({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},1,1);
      P = pas.System.Pos(".",Result);
      if (TS !== "") {
        if (P !== 0) {
          Result = $impl.ReplaceDecimalSep(Result,DS)}
         else P = Result.length + 1;
        P -= 3;
        while (P > 1) {
          pas.System.Insert(TS,{get: function () {
              return Result;
            }, set: function (v) {
              Result = v;
            }},P);
          P -= 3;
        };
      };
      if (Negative) $impl.RemoveLeadingNegativeSign({get: function () {
          return Result;
        }, set: function (v) {
          Result = v;
        }},DS,TS);
      if (!Negative) {
        var $tmp = aSettings.CurrencyFormat;
        if ($tmp === 0) {
          Result = CS + Result}
         else if ($tmp === 1) {
          Result = Result + CS}
         else if ($tmp === 2) {
          Result = CS + " " + Result}
         else if ($tmp === 3) Result = Result + " " + CS;
      } else {
        var $tmp1 = aSettings.NegCurrFormat;
        if ($tmp1 === 0) {
          Result = "(" + CS + Result + ")"}
         else if ($tmp1 === 1) {
          Result = "-" + CS + Result}
         else if ($tmp1 === 2) {
          Result = CS + "-" + Result}
         else if ($tmp1 === 3) {
          Result = CS + Result + "-"}
         else if ($tmp1 === 4) {
          Result = "(" + Result + CS + ")"}
         else if ($tmp1 === 5) {
          Result = "-" + Result + CS}
         else if ($tmp1 === 6) {
          Result = Result + "-" + CS}
         else if ($tmp1 === 7) {
          Result = Result + CS + "-"}
         else if ($tmp1 === 8) {
          Result = "-" + Result + " " + CS}
         else if ($tmp1 === 9) {
          Result = "-" + CS + " " + Result}
         else if ($tmp1 === 10) {
          Result = Result + " " + CS + "-"}
         else if ($tmp1 === 11) {
          Result = CS + " " + Result + "-"}
         else if ($tmp1 === 12) {
          Result = CS + " " + "-" + Result}
         else if ($tmp1 === 13) {
          Result = Result + "-" + " " + CS}
         else if ($tmp1 === 14) {
          Result = "(" + CS + " " + Result + ")"}
         else if ($tmp1 === 15) Result = "(" + Result + " " + CS + ")";
      };
      return Result;
    };
    $impl.IntTryStrToInt = function (S, res, aSep) {
      var Result = false;
      var Radix = 10;
      var N = "";
      var J = undefined;
      N = S;
      if ((pas.System.Pos(aSep,N) !== 0) || (pas.System.Pos(".",N) !== 0)) return false;
      var $tmp = pas.System.Copy(N,1,1);
      if ($tmp === "$") {
        Radix = 16}
       else if ($tmp === "&") {
        Radix = 8}
       else if ($tmp === "%") Radix = 2;
      if ((Radix !== 16) && (pas.System.Pos("e",$mod.LowerCase(N)) !== 0)) return false;
      if (Radix !== 10) pas.System.Delete({get: function () {
          return N;
        }, set: function (v) {
          N = v;
        }},1,1);
      J = parseInt(N,Radix);
      Result = !isNaN(J);
      if (Result) res.set(rtl.trunc(J));
      return Result;
    };
  };
  $mod.$init = function () {
    $mod.ShortMonthNames = $impl.DefaultShortMonthNames.slice(0);
    $mod.LongMonthNames = $impl.DefaultLongMonthNames.slice(0);
    $mod.ShortDayNames = $impl.DefaultShortDayNames.slice(0);
    $mod.LongDayNames = $impl.DefaultLongDayNames.slice(0);
    $mod.FormatSettings.$assign($mod.TFormatSettings.Create());
    $mod.TimeSeparator = $mod.FormatSettings.TimeSeparator;
    $mod.DateSeparator = $mod.FormatSettings.DateSeparator;
    $mod.ShortDateFormat = $mod.FormatSettings.ShortDateFormat;
    $mod.LongDateFormat = $mod.FormatSettings.LongDateFormat;
    $mod.ShortTimeFormat = $mod.FormatSettings.ShortTimeFormat;
    $mod.LongTimeFormat = $mod.FormatSettings.LongTimeFormat;
    $mod.DecimalSeparator = $mod.FormatSettings.DecimalSeparator;
    $mod.ThousandSeparator = $mod.FormatSettings.ThousandSeparator;
    $mod.TimeAMString = $mod.FormatSettings.TimeAMString;
    $mod.TimePMString = $mod.FormatSettings.TimePMString;
    $mod.CurrencyFormat = $mod.FormatSettings.CurrencyFormat;
    $mod.NegCurrFormat = $mod.FormatSettings.NegCurrFormat;
    $mod.CurrencyDecimals = $mod.FormatSettings.CurrencyDecimals;
    $mod.CurrencyString = $mod.FormatSettings.CurrencyString;
  };
},[]);
rtl.module("Classes",["System","RTLConsts","Types","SysUtils","JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass(this,"EListError",pas.SysUtils.Exception,function () {
  });
  rtl.createClass(this,"TFPList",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FList = [];
      this.FCount = 0;
      this.FCapacity = 0;
    };
    this.$final = function () {
      this.FList = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Get = function (Index) {
      var Result = undefined;
      if ((Index < 0) || (Index >= this.FCount)) this.RaiseIndexError(Index);
      Result = this.FList[Index];
      return Result;
    };
    this.SetCapacity = function (NewCapacity) {
      if (NewCapacity < this.FCount) this.$class.Error(rtl.getResStr(pas.RTLConsts,"SListCapacityError"),"" + NewCapacity);
      if (NewCapacity === this.FCapacity) return;
      this.FList = rtl.arraySetLength(this.FList,undefined,NewCapacity);
      this.FCapacity = NewCapacity;
    };
    this.SetCount = function (NewCount) {
      if (NewCount < 0) this.$class.Error(rtl.getResStr(pas.RTLConsts,"SListCountError"),"" + NewCount);
      if (NewCount > this.FCount) {
        if (NewCount > this.FCapacity) this.SetCapacity(NewCount);
      };
      this.FCount = NewCount;
    };
    this.RaiseIndexError = function (Index) {
      this.$class.Error(rtl.getResStr(pas.RTLConsts,"SListIndexError"),"" + Index);
    };
    this.Destroy = function () {
      this.Clear();
      pas.System.TObject.Destroy.call(this);
    };
    this.Add = function (Item) {
      var Result = 0;
      if (this.FCount === this.FCapacity) this.Expand();
      this.FList[this.FCount] = Item;
      Result = this.FCount;
      this.FCount += 1;
      return Result;
    };
    this.Clear = function () {
      if (rtl.length(this.FList) > 0) {
        this.SetCount(0);
        this.SetCapacity(0);
      };
    };
    this.Delete = function (Index) {
      if ((Index < 0) || (Index >= this.FCount)) this.$class.Error(rtl.getResStr(pas.RTLConsts,"SListIndexError"),"" + Index);
      this.FCount = this.FCount - 1;
      this.FList.splice(Index,1);
      this.FCapacity -= 1;
    };
    this.Error = function (Msg, Data) {
      throw $mod.EListError.$create("CreateFmt",[Msg,pas.System.VarRecs(18,Data)]);
    };
    this.Expand = function () {
      var Result = null;
      var IncSize = 0;
      if (this.FCount < this.FCapacity) return this;
      IncSize = 4;
      if (this.FCapacity > 3) IncSize = IncSize + 4;
      if (this.FCapacity > 8) IncSize = IncSize + 8;
      if (this.FCapacity > 127) IncSize += this.FCapacity >>> 2;
      this.SetCapacity(this.FCapacity + IncSize);
      Result = this;
      return Result;
    };
    this.IndexOf = function (Item) {
      var Result = 0;
      var C = 0;
      Result = 0;
      C = this.FCount;
      while ((Result < C) && (this.FList[Result] != Item)) Result += 1;
      if (Result >= C) Result = -1;
      return Result;
    };
  });
  this.TListNotification = {"0": "lnAdded", lnAdded: 0, "1": "lnExtracted", lnExtracted: 1, "2": "lnDeleted", lnDeleted: 2};
  rtl.createClass(this,"TListEnumerator",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FList = null;
      this.FPosition = 0;
    };
    this.$final = function () {
      this.FList = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (AList) {
      pas.System.TObject.Create.call(this);
      this.FList = AList;
      this.FPosition = -1;
      return this;
    };
    this.GetCurrent = function () {
      var Result = undefined;
      Result = this.FList.Get(this.FPosition);
      return Result;
    };
    this.MoveNext = function () {
      var Result = false;
      this.FPosition += 1;
      Result = this.FPosition < this.FList.GetCount();
      return Result;
    };
  });
  rtl.createClass(this,"TList",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.FList = null;
    };
    this.$final = function () {
      this.FList = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Get = function (Index) {
      var Result = undefined;
      Result = this.FList.Get(Index);
      return Result;
    };
    this.Notify = function (aValue, Action) {
      if (pas.System.Assigned(aValue)) ;
      if (Action === 1) ;
    };
    this.GetCount = function () {
      var Result = 0;
      Result = this.FList.FCount;
      return Result;
    };
    this.Create$1 = function () {
      pas.System.TObject.Create.call(this);
      this.FList = $mod.TFPList.$create("Create");
      return this;
    };
    this.Destroy = function () {
      if (this.FList != null) this.Clear();
      pas.SysUtils.FreeAndNil({p: this, get: function () {
          return this.p.FList;
        }, set: function (v) {
          this.p.FList = v;
        }});
    };
    this.Add = function (Item) {
      var Result = 0;
      Result = this.FList.Add(Item);
      if (pas.System.Assigned(Item)) this.Notify(Item,0);
      return Result;
    };
    this.Clear = function () {
      while (this.FList.FCount > 0) this.Delete(this.GetCount() - 1);
    };
    this.Delete = function (Index) {
      var V = undefined;
      V = this.FList.Get(Index);
      this.FList.Delete(Index);
      if (pas.System.Assigned(V)) this.Notify(V,2);
    };
    this.GetEnumerator = function () {
      var Result = null;
      Result = $mod.TListEnumerator.$create("Create$1",[this]);
      return Result;
    };
    this.IndexOf = function (Item) {
      var Result = 0;
      Result = this.FList.IndexOf(Item);
      return Result;
    };
    this.Remove = function (Item) {
      var Result = 0;
      Result = this.IndexOf(Item);
      if (Result !== -1) this.Delete(Result);
      return Result;
    };
  });
  $mod.$implcode = function () {
    $impl.ClassList = null;
  };
  $mod.$init = function () {
    $impl.ClassList = new Object();
  };
},[]);
rtl.module("webaudio",["System","SysUtils","JS","Web","Types"],function () {
  "use strict";
  var $mod = this;
});
rtl.module("gameaudio",["System","Web","webaudio","Classes"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.TGameAudioPlayState = {"0": "psNormal", psNormal: 0, "1": "psFadeout", psFadeout: 1, "2": "psDone", psDone: 2};
  rtl.createClass(this,"TGameAudioSource",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fFadeStart = 0.0;
      this.fFadeTime = 0.0;
      this.fLooping = false;
      this.fAudio = null;
      this.fOnEnd = null;
      this.fState = 0;
      this.fVolume = 0.0;
    };
    this.$final = function () {
      this.fAudio = undefined;
      this.fOnEnd = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (ASource, AVolume, ALooping) {
      pas.System.TObject.Create.call(this);
      this.fLooping = ALooping;
      this.fAudio = $impl.Clone(ASource);
      this.fAudio.loop = ALooping;
      this.fAudio.volume = AVolume;
      this.fAudio.play();
      this.fState = 0;
      this.fVolume = AVolume;
      return this;
    };
    this.Destroy = function () {
      this.fAudio = null;
      pas.System.TObject.Destroy.call(this);
    };
    this.FadeOut = function (AStartTime, ATime) {
      if (this.fState === 0) {
        this.fState = 1;
        this.fFadeStart = AStartTime;
        this.fFadeTime = ATime;
      };
    };
    this.Update = function (ATime) {
      var newVolume = 0.0;
      if (this.fState === 1) {
        newVolume = $impl.Lerp(this.fVolume,0,(ATime - this.fFadeStart) / this.fFadeTime);
        if (newVolume < 0) {
          this.fState = 2;
          this.fAudio.volume = 0;
        } else this.fAudio.volume = newVolume;
      } else if (this.fAudio.ended) {
        this.fState = 2;
        if (this.fOnEnd !== null) this.fOnEnd(this);
      };
    };
  });
  rtl.createClass(this,"TGameAudio",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fSources = null;
      this.fAudioCtx = null;
    };
    this.$final = function () {
      this.fSources = undefined;
      this.fAudioCtx = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function () {
      pas.System.TObject.Create.call(this);
      this.fAudioCtx = $impl.GetContext();
      this.fSources = pas.Classes.TList.$create("Create$1");
      return this;
    };
    this.Play = function (ASource, AVolume, ALooping) {
      var Result = null;
      if (ASource === null) return Result;
      Result = $mod.TGameAudioSource.$create("Create$1",[ASource,AVolume,ALooping]);
      this.fSources.Add(Result);
      return Result;
    };
    this.FadeAll = function (ACurrentTimeMS, AFadeTimeMS) {
      var el = undefined;
      var $in = this.fSources.GetEnumerator();
      try {
        while ($in.MoveNext()) {
          el = $in.GetCurrent();
          rtl.getObject(el).FadeOut(ACurrentTimeMS,AFadeTimeMS);
        }
      } finally {
        $in = rtl.freeLoc($in)
      };
    };
    this.Update = function (ATimeMS) {
      var el = undefined;
      var toRemove = null;
      if (this.fAudioCtx.state === "suspended") this.fAudioCtx.resume();
      toRemove = pas.Classes.TList.$create("Create$1");
      var $in = this.fSources.GetEnumerator();
      try {
        while ($in.MoveNext()) {
          el = $in.GetCurrent();
          rtl.getObject(el).Update(ATimeMS);
          if (rtl.getObject(el).fState === 2) toRemove.Add(el);
        }
      } finally {
        $in = rtl.freeLoc($in)
      };
      var $in1 = toRemove.GetEnumerator();
      try {
        while ($in1.MoveNext()) {
          el = $in1.GetCurrent();
          this.fSources.Remove(el);
          rtl.getObject(el).$destroy("Destroy");
        }
      } finally {
        $in1 = rtl.freeLoc($in1)
      };
      toRemove = rtl.freeLoc(toRemove);
    };
  });
  $mod.$implcode = function () {
    $impl.GetContext = function () {
      return new (window.AudioContext || window.webkitAudioContext)();
    };
    $impl.Clone = function (n) {
      return n.cloneNode();
    };
    $impl.Lerp = function (a, b, t) {
      var Result = 0.0;
      Result = ((b - a) * t) + a;
      return Result;
    };
  };
},[]);
rtl.module("GameMath",["System","Classes","SysUtils","Math"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.recNewT(this,"TPVector",function () {
    this.X = 0.0;
    this.Y = 0.0;
    this.Z = 0.0;
    this.$eq = function (b) {
      return (this.X === b.X) && (this.Y === b.Y) && (this.Z === b.Z);
    };
    this.$assign = function (s) {
      this.X = s.X;
      this.Y = s.Y;
      this.Z = s.Z;
      return this;
    };
    this.New = function (AX, AY, AZ) {
      var Result = $mod.TPVector.$new();
      Result.X = AX;
      Result.Y = AY;
      Result.Z = AZ;
      return Result;
    };
    this.Length = function () {
      var Result = 0.0;
      Result = pas.System.Sqr$1(this.X) + pas.System.Sqr$1(this.Y) + pas.System.Sqr$1(this.Z);
      if (Result > 0) Result = Math.sqrt(Result);
      return Result;
    };
    this.LengthSqr = function () {
      var Result = 0.0;
      Result = pas.System.Sqr$1(this.X) + pas.System.Sqr$1(this.Y) + pas.System.Sqr$1(this.Z);
      return Result;
    };
    this.Normalize = function () {
      var Result = $mod.TPVector.$new();
      var l = 0.0;
      l = this.Length();
      if (l !== 0) {
        Result.$assign(this.Scale(1 / l))}
       else Result.$assign(this.New(0,0,0));
      return Result;
    };
    this.Dot = function (A) {
      var Result = 0.0;
      Result = (this.X * A.X) + (this.Y * A.Y) + (this.Z * A.Z);
      return Result;
    };
    this.Add = function (A) {
      var Result = $mod.TPVector.$new();
      Result.X = this.X + A.X;
      Result.Y = this.Y + A.Y;
      Result.Z = this.Z + A.Z;
      return Result;
    };
    this.Sub = function (A) {
      var Result = $mod.TPVector.$new();
      Result.X = this.X - A.X;
      Result.Y = this.Y - A.Y;
      Result.Z = this.Z - A.Z;
      return Result;
    };
    this.Multiply = function (A) {
      var Result = $mod.TPVector.$new();
      Result.X = this.X * A.X;
      Result.Y = this.Y * A.Y;
      Result.Z = this.Z * A.Z;
      return Result;
    };
    this.Scale = function (A) {
      var Result = $mod.TPVector.$new();
      Result.X = this.X * A;
      Result.Y = this.Y * A;
      Result.Z = this.Z * A;
      return Result;
    };
    this.Clamp = function (AMin, AMax) {
      var Result = $mod.TPVector.$new();
      Result.X = $impl.FClamp(this.X,AMin.X,AMax.X);
      Result.Y = $impl.FClamp(this.Y,AMin.Y,AMax.Y);
      Result.Z = $impl.FClamp(this.Z,AMin.Z,AMax.Z);
      return Result;
    };
    this.Cross = function (A, B) {
      var Result = $mod.TPVector.$new();
      Result.X = (A.Y * B.Z) - (A.Z * B.Y);
      Result.Y = (A.Z * B.X) - (A.X * B.Z);
      Result.Z = (A.X * B.Y) - (A.Y * B.X);
      return Result;
    };
  });
  rtl.createClass(this,"TPMatrix",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fIsIdentity = false;
      this.fIsTranslation = false;
      this.fHasInverse = false;
      this.inv = rtl.arraySetLength(null,0.0,16);
      this.V = rtl.arraySetLength(null,0.0,16);
    };
    this.$final = function () {
      this.inv = undefined;
      this.V = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.GetInverse = function () {
      var Result = null;
      var det = 0.0;
      var i = 0;
      if (!this.fHasInverse) {
        this.inv[0] = (((this.V[5] * this.V[10] * this.V[15]) - (this.V[5] * this.V[11] * this.V[14]) - (this.V[9] * this.V[6] * this.V[15])) + (this.V[9] * this.V[7] * this.V[14]) + (this.V[13] * this.V[6] * this.V[11])) - (this.V[13] * this.V[7] * this.V[10]);
        this.inv[4] = (((-this.V[4] * this.V[10] * this.V[15]) + (this.V[4] * this.V[11] * this.V[14]) + (this.V[8] * this.V[6] * this.V[15])) - (this.V[8] * this.V[7] * this.V[14]) - (this.V[12] * this.V[6] * this.V[11])) + (this.V[12] * this.V[7] * this.V[10]);
        this.inv[8] = (((this.V[4] * this.V[9] * this.V[15]) - (this.V[4] * this.V[11] * this.V[13]) - (this.V[8] * this.V[5] * this.V[15])) + (this.V[8] * this.V[7] * this.V[13]) + (this.V[12] * this.V[5] * this.V[11])) - (this.V[12] * this.V[7] * this.V[9]);
        this.inv[12] = (((-this.V[4] * this.V[9] * this.V[14]) + (this.V[4] * this.V[10] * this.V[13]) + (this.V[8] * this.V[5] * this.V[14])) - (this.V[8] * this.V[6] * this.V[13]) - (this.V[12] * this.V[5] * this.V[10])) + (this.V[12] * this.V[6] * this.V[9]);
        this.inv[1] = (((-this.V[1] * this.V[10] * this.V[15]) + (this.V[1] * this.V[11] * this.V[14]) + (this.V[9] * this.V[2] * this.V[15])) - (this.V[9] * this.V[3] * this.V[14]) - (this.V[13] * this.V[2] * this.V[11])) + (this.V[13] * this.V[3] * this.V[10]);
        this.inv[5] = (((this.V[0] * this.V[10] * this.V[15]) - (this.V[0] * this.V[11] * this.V[14]) - (this.V[8] * this.V[2] * this.V[15])) + (this.V[8] * this.V[3] * this.V[14]) + (this.V[12] * this.V[2] * this.V[11])) - (this.V[12] * this.V[3] * this.V[10]);
        this.inv[9] = (((-this.V[0] * this.V[9] * this.V[15]) + (this.V[0] * this.V[11] * this.V[13]) + (this.V[8] * this.V[1] * this.V[15])) - (this.V[8] * this.V[3] * this.V[13]) - (this.V[12] * this.V[1] * this.V[11])) + (this.V[12] * this.V[3] * this.V[9]);
        this.inv[13] = (((this.V[0] * this.V[9] * this.V[14]) - (this.V[0] * this.V[10] * this.V[13]) - (this.V[8] * this.V[1] * this.V[14])) + (this.V[8] * this.V[2] * this.V[13]) + (this.V[12] * this.V[1] * this.V[10])) - (this.V[12] * this.V[2] * this.V[9]);
        this.inv[2] = (((this.V[1] * this.V[6] * this.V[15]) - (this.V[1] * this.V[7] * this.V[14]) - (this.V[5] * this.V[2] * this.V[15])) + (this.V[5] * this.V[3] * this.V[14]) + (this.V[13] * this.V[2] * this.V[7])) - (this.V[13] * this.V[3] * this.V[6]);
        this.inv[6] = (((-this.V[0] * this.V[6] * this.V[15]) + (this.V[0] * this.V[7] * this.V[14]) + (this.V[4] * this.V[2] * this.V[15])) - (this.V[4] * this.V[3] * this.V[14]) - (this.V[12] * this.V[2] * this.V[7])) + (this.V[12] * this.V[3] * this.V[6]);
        this.inv[10] = (((this.V[0] * this.V[5] * this.V[15]) - (this.V[0] * this.V[7] * this.V[13]) - (this.V[4] * this.V[1] * this.V[15])) + (this.V[4] * this.V[3] * this.V[13]) + (this.V[12] * this.V[1] * this.V[7])) - (this.V[12] * this.V[3] * this.V[5]);
        this.inv[14] = (((-this.V[0] * this.V[5] * this.V[14]) + (this.V[0] * this.V[6] * this.V[13]) + (this.V[4] * this.V[1] * this.V[14])) - (this.V[4] * this.V[2] * this.V[13]) - (this.V[12] * this.V[1] * this.V[6])) + (this.V[12] * this.V[2] * this.V[5]);
        this.inv[3] = (((-this.V[1] * this.V[6] * this.V[11]) + (this.V[1] * this.V[7] * this.V[10]) + (this.V[5] * this.V[2] * this.V[11])) - (this.V[5] * this.V[3] * this.V[10]) - (this.V[9] * this.V[2] * this.V[7])) + (this.V[9] * this.V[3] * this.V[6]);
        this.inv[7] = (((this.V[0] * this.V[6] * this.V[11]) - (this.V[0] * this.V[7] * this.V[10]) - (this.V[4] * this.V[2] * this.V[11])) + (this.V[4] * this.V[3] * this.V[10]) + (this.V[8] * this.V[2] * this.V[7])) - (this.V[8] * this.V[3] * this.V[6]);
        this.inv[11] = (((-this.V[0] * this.V[5] * this.V[11]) + (this.V[0] * this.V[7] * this.V[9]) + (this.V[4] * this.V[1] * this.V[11])) - (this.V[4] * this.V[3] * this.V[9]) - (this.V[8] * this.V[1] * this.V[7])) + (this.V[8] * this.V[3] * this.V[5]);
        this.inv[15] = (((this.V[0] * this.V[5] * this.V[10]) - (this.V[0] * this.V[6] * this.V[9]) - (this.V[4] * this.V[1] * this.V[10])) + (this.V[4] * this.V[2] * this.V[9]) + (this.V[8] * this.V[1] * this.V[6])) - (this.V[8] * this.V[2] * this.V[5]);
        det = (this.V[0] * this.inv[0]) + (this.V[1] * this.inv[4]) + (this.V[2] * this.inv[8]) + (this.V[3] * this.inv[12]);
        if (det === 0) {
          pas.System.Writeln("fff");
          return this.Identity();
        };
        det = 1.0 / det;
        for (i = 0; i <= 15; i++) this.inv[i] = this.inv[i] * det;
        this.fHasInverse = true;
      };
      Result = $mod.TPMatrix.$create("Create$1",[this.inv]);
      return Result;
    };
    this.Create$1 = function (AMatrix) {
      this.V = AMatrix.slice(0);
      this.fIsIdentity = false;
      this.fIsTranslation = false;
      return this;
    };
    this.Identity = function () {
      var i = 0;
      for (i = 0; i <= 8; i++) this.V[i] = 0;
      this.V[0] = 1;
      this.V[5] = 1;
      this.V[10] = 1;
      this.V[15] = 1;
      this.fIsIdentity = true;
      this.fIsTranslation = true;
      return this;
    };
    this.CreateTranslation = function (AX, AY, AZ) {
      this.Identity();
      this.V[12] = AX;
      this.V[13] = AY;
      this.V[14] = AZ;
      this.fIsIdentity = false;
      this.fIsTranslation = true;
      return this;
    };
    this.CreateRotationZ = function (ARotation) {
      var cs = 0.0;
      var ss = 0.0;
      this.Identity();
      if (ARotation !== 0) {
        cs = Math.cos(ARotation);
        ss = Math.sin(ARotation);
        this.V[0] = cs;
        this.V[1] = -ss;
        this.V[4] = ss;
        this.V[5] = cs;
        this.fIsIdentity = false;
        this.fIsTranslation = false;
      };
      return this;
    };
    this.CreateScale = function (AX, AY, AZ) {
      this.Identity();
      this.V[0] = AX;
      this.V[5] = AY;
      this.V[10] = AZ;
      this.fIsIdentity = false;
      this.fIsTranslation = false;
      return this;
    };
    this.Ortho = function (ALeft, ARight, ABottom, ATop, AZNear, AZFar) {
      var Width = 0.0;
      var Height = 0.0;
      var Depth = 0.0;
      Width = ARight - ALeft;
      Height = ATop - ABottom;
      Depth = AZFar - AZNear;
      this.Identity();
      this.V[0] = 2.0 / Width;
      this.V[5] = 2.0 / Height;
      this.V[10] = -2.0 / Depth;
      this.V[12] = -(ARight + ALeft) / Width;
      this.V[13] = -(ATop + ABottom) / Height;
      this.V[11] = -(AZFar + AZNear) / Depth;
      this.fIsIdentity = false;
      this.fIsTranslation = false;
      return this;
    };
    this.LookAt = function (ATarget, AOrigin, AUp) {
      var zaxis = $mod.TPVector.$new();
      var yaxis = $mod.TPVector.$new();
      var xaxis = $mod.TPVector.$new();
      this.Identity();
      zaxis.$assign(ATarget.Sub(AOrigin).Normalize());
      xaxis.$assign($mod.TPVector.Cross($mod.TPVector.$clone(zaxis),$mod.TPVector.$clone(AUp)).Normalize());
      yaxis.$assign($mod.TPVector.Cross($mod.TPVector.$clone(xaxis),$mod.TPVector.$clone(zaxis)));
      zaxis.$assign(zaxis.Scale(-1));
      this.V = [xaxis.X,yaxis.X,zaxis.X,0,xaxis.Y,yaxis.Y,zaxis.Y,0,xaxis.Z,yaxis.Z,zaxis.Z,0,-xaxis.Dot(AOrigin),-yaxis.Dot(AOrigin),-zaxis.Dot(AOrigin),1];
      this.fIsIdentity = false;
      this.fIsTranslation = false;
      return this;
    };
    this.Multiply = function (AVec) {
      var Result = $mod.TPVector.$new();
      if (this.fIsIdentity) return AVec;
      if (this.fIsTranslation) {
        Result.X = AVec.X + this.V[3];
        Result.Y = AVec.Y + this.V[7];
        Result.Z = AVec.Z + this.V[11];
      } else {
        Result.X = (AVec.X * this.V[0]) + (AVec.Y * this.V[1]) + (AVec.Z * this.V[2]) + this.V[3];
        Result.Y = (AVec.X * this.V[4]) + (AVec.Y * this.V[5]) + (AVec.Z * this.V[6]) + this.V[7];
        Result.Z = (AVec.X * this.V[8]) + (AVec.Y * this.V[9]) + (AVec.Z * this.V[10]) + this.V[11];
      };
      return Result;
    };
    this.Multiply$1 = function (AMat) {
      var Result = null;
      var n = rtl.arraySetLength(null,0.0,16);
      var v2 = rtl.arraySetLength(null,0.0,16);
      var i = 0;
      var i2 = 0;
      var i3 = 0;
      var s = 0.0;
      v2 = AMat.V;
      for (i = 0; i <= 3; i++) for (i2 = 0; i2 <= 3; i2++) {
        s = 0;
        for (i3 = 0; i3 <= 3; i3++) s = s + (this.V[(i * 4) + i3] * v2[(i3 * 4) + i2]);
        n[(i * 4) + i2] = s;
      };
      Result = $mod.TPMatrix.$create("Create$1",[n]);
      return Result;
    };
    this.Transpose = function () {
      var Result = null;
      Result = $mod.TPMatrix.$create("Create$1",[[this.V[0],this.V[4],this.V[8],this.V[12],this.V[1],this.V[5],this.V[9],this.V[13],this.V[2],this.V[6],this.V[10],this.V[14],this.V[3],this.V[7],this.V[11],this.V[15]]]);
      return Result;
    };
    this.TransformInplace = function (AVectors) {
      var i = 0;
      var x = 0.0;
      var y = 0.0;
      var z = 0.0;
      if (this.fIsIdentity) return;
      if (this.fIsTranslation) {
        for (var $l = 0, $end = rtl.length(AVectors.get()) - 1; $l <= $end; $l++) {
          i = $l;
          AVectors.get()[i].X = AVectors.get()[i].X + this.V[3];
          AVectors.get()[i].Y = AVectors.get()[i].Y + this.V[7];
          AVectors.get()[i].Z = AVectors.get()[i].Z + this.V[11];
        }}
       else for (var $l1 = 0, $end1 = rtl.length(AVectors.get()) - 1; $l1 <= $end1; $l1++) {
        i = $l1;
        x = AVectors.get()[i].X;
        y = AVectors.get()[i].Y;
        z = AVectors.get()[i].Z;
        AVectors.get()[i].X = (x * this.V[0]) + (y * this.V[1]) + (z * this.V[2]) + this.V[3];
        AVectors.get()[i].Y = (x * this.V[4]) + (y * this.V[5]) + (z * this.V[6]) + this.V[7];
        AVectors.get()[i].Z = (x * this.V[8]) + (y * this.V[9]) + (z * this.V[10]) + this.V[11];
      };
    };
  });
  $mod.$implcode = function () {
    $impl.FClamp = function (AValue, amin, amax) {
      var Result = 0.0;
      if (AValue < amin) {
        Result = amin}
       else if (AValue > amax) {
        Result = amax}
       else Result = AValue;
      return Result;
    };
  };
},[]);
rtl.module("contnrs",["System","SysUtils","Classes"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TObjectList",pas.Classes.TList,function () {
    this.$init = function () {
      pas.Classes.TList.$init.call(this);
      this.FFreeObjects = false;
    };
    this.Notify = function (Ptr, Action) {
      var O = null;
      if (this.FFreeObjects) if (Action === 2) {
        O = rtl.getObject(Ptr);
        O = rtl.freeLoc(O);
      };
      pas.Classes.TList.Notify.call(this,Ptr,Action);
    };
    this.Create$3 = function (FreeObjects) {
      pas.Classes.TList.Create$1.call(this);
      this.FFreeObjects = FreeObjects;
      return this;
    };
    this.Add$1 = function (AObject) {
      var Result = 0;
      Result = pas.Classes.TList.Add.call(this,AObject);
      return Result;
    };
  });
},["JS"]);
rtl.module("GameBase",["System","JS","Web","webgl","gameaudio","GameMath","SysUtils","Classes","contnrs"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.DisableDepthForTransparent = true;
  rtl.recNewT(this,"TGameColor",function () {
    this.R = 0.0;
    this.G = 0.0;
    this.B = 0.0;
    this.A = 0.0;
    this.$eq = function (b) {
      return (this.R === b.R) && (this.G === b.G) && (this.B === b.B) && (this.A === b.A);
    };
    this.$assign = function (s) {
      this.R = s.R;
      this.G = s.G;
      this.B = s.B;
      this.A = s.A;
      return this;
    };
    this.Transparent = function () {
      var Result = $mod.TGameColor.$new();
      Result.$assign($mod.TGameColor.New(0,0,0,0));
      return Result;
    };
    this.New = function (AR, AG, AB, AA) {
      var Result = $mod.TGameColor.$new();
      Result.R = AR;
      Result.G = AG;
      Result.B = AB;
      Result.A = AA;
      return Result;
    };
  });
  rtl.recNewT(this,"TGameViewport",function () {
    this.Projection = null;
    this.ModelView = null;
    this.$eq = function (b) {
      return (this.Projection === b.Projection) && (this.ModelView === b.ModelView);
    };
    this.$assign = function (s) {
      this.Projection = s.Projection;
      this.ModelView = s.ModelView;
      return this;
    };
  });
  rtl.createClass(this,"TGameElement",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fOpaque = false;
      this.fPosition = pas.GameMath.TPVector.$new();
      this.fVisible = false;
    };
    this.$final = function () {
      this.fPosition = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Update = function (AGame, ATimeMS) {
    };
    this.Render = function (GL, AViewport) {
    };
    this.Create$1 = function (AOpaque) {
      pas.System.TObject.Create.call(this);
      this.fOpaque = AOpaque;
      this.fVisible = true;
      return this;
    };
  });
  rtl.createClass(this,"TGameTexture",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fID = null;
      this.fWidth = 0;
      this.fHeight = 0;
    };
    this.$final = function () {
      this.fID = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (AWidth, AHeight) {
      var gl = null;
      var pixel = null;
      gl = $mod.Game().GL;
      this.fID = gl.createTexture();
      gl.bindTexture(3553,this.fID);
      pixel = new Uint8Array(4 * AWidth * AHeight);
      gl.texImage2D(3553,0,6408,AWidth,AHeight,0,6408,5121,pixel);
      this.fWidth = AWidth;
      this.fHeight = AHeight;
      return this;
    };
    this.Load = function (ASrc) {
      var gl = null;
      gl = $mod.Game().GL;
      this.fWidth = ASrc.width;
      this.fHeight = ASrc.height;
      gl.bindTexture(3553,this.fID);
      gl.texImage2D(3553,0,6408,6408,5121,ASrc);
      if ($impl.IsPowerOf2(ASrc.width) && $impl.IsPowerOf2(ASrc.height)) {
        gl.generateMipmap(3553);
        gl.texParameteri(3553,10242,33071);
        gl.texParameteri(3553,10243,33071);
        gl.texParameteri(3553,10241,9987);
      } else {
        gl.texParameteri(3553,10242,33071);
        gl.texParameteri(3553,10243,33071);
        gl.texParameteri(3553,10241,9728);
      };
    };
    this.Destroy = function () {
      $mod.Game().GL.deleteTexture(this.fID);
      pas.System.TObject.Destroy.call(this);
    };
  });
  rtl.createClass(this,"TGameShader",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fVID = null;
      this.fFID = null;
      this.fProg = null;
    };
    this.$final = function () {
      this.fVID = undefined;
      this.fFID = undefined;
      this.fProg = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.LoadShader = function (GL, ASrc, AType) {
      var Result = null;
      var err = "";
      Result = GL.createShader(AType);
      GL.shaderSource(Result,ASrc);
      GL.compileShader(Result);
      if (GL.getShaderParameter(Result,35713) == 0) {
        err = GL.getShaderInfoLog(Result);
        window.console.error("Failed to compile shader: " + err);
      };
      return Result;
    };
    this.Create$1 = function (AVertex, AFragment) {
      var gl = null;
      var err = "";
      pas.System.TObject.Create.call(this);
      gl = $mod.Game().GL;
      this.fVID = this.LoadShader(gl,AVertex,35633);
      this.fFID = this.LoadShader(gl,AFragment,35632);
      this.fProg = gl.createProgram();
      gl.attachShader(this.fProg,this.fVID);
      gl.attachShader(this.fProg,this.fFID);
      gl.linkProgram(this.fProg);
      if (gl.getProgramParameter(this.fProg,35714) == 0) {
        err = gl.getProgramInfoLog(this.fProg);
        window.console.error("Failed to link: " + err);
      };
      return this;
    };
  });
  this.TGameBaseState = {"0": "bsStart", bsStart: 0, "1": "bsWaitResources", bsWaitResources: 1, "2": "bsDone", bsDone: 2};
  this.TGameMouseState = {"0": "msUp", msUp: 0, "1": "msDragging", msDragging: 1, "2": "msDown", msDown: 2};
  rtl.createClass(this,"TGameBase",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fAudio = null;
      this.fHeight = 0;
      this.fWidth = 0;
      this.fMouseStartY = 0.0;
      this.fMouseStartX = 0.0;
      this.fToFree = null;
      this.fElements = null;
      this.fState = 0;
      this.fMouseState = 0;
      this.Canvas = null;
      this.GL = null;
      this.Viewport = $mod.TGameViewport.$new();
    };
    this.$final = function () {
      this.fAudio = undefined;
      this.fToFree = undefined;
      this.fElements = undefined;
      this.Canvas = undefined;
      this.GL = undefined;
      this.Viewport = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.OnCanvasKeyPress = function (aEvent) {
      var Result = false;
      if (this.fState === 2) this.DoKeyPress(aEvent.code);
      Result = true;
      return Result;
    };
    this.OnCanvasLeave = function (aEvent) {
      var Result = false;
      if (this.fMouseState === 1) {
        this.fMouseState = 0;
        this.DoStopDrag();
      };
      Result = true;
      return Result;
    };
    this.OnCanvasMouseDown = function (aEvent) {
      var Result = false;
      Result = true;
      if (this.fState === 2) {
        if (aEvent.button === 0) {
          this.fMouseStartX = aEvent.clientX;
          this.fMouseStartY = aEvent.clientY;
          this.fMouseState = 2;
        };
      };
      return Result;
    };
    this.OnCanvasMouseUp = function (aEvent) {
      var Result = false;
      if (this.fMouseState !== 0) {
        if (this.fMouseState === 1) {
          this.DoStopDrag()}
         else this.DoClick(aEvent.clientX,aEvent.clientY,aEvent.buttons);
        this.fMouseState = 0;
      };
      Result = true;
      return Result;
    };
    this.OnCanvasMove = function (aEvent) {
      var Result = false;
      if (this.fState === 2) {
        if ((this.fMouseState === 2) && (pas.System.Sqr(500) <= (pas.System.Sqr$1(aEvent.clientX - this.fMouseStartX) + pas.System.Sqr$1(aEvent.clientY - this.fMouseStartY)))) {
          this.fMouseState = 1;
          this.DoStartDrag(this.fMouseStartX,this.fMouseStartY);
        } else this.DoMove(aEvent.clientX,aEvent.clientY);
      };
      Result = true;
      return Result;
    };
    this.OnCanvasWheel = function (aEvent) {
      var Result = false;
      if (this.fState === 2) this.DoWheel(aEvent.deltaY);
      Result = true;
      return Result;
    };
    this.OnResize = function (Event) {
      var Result = false;
      this.fWidth = window.innerWidth;
      this.fHeight = window.innerHeight;
      this.Canvas.width = this.fWidth;
      this.Canvas.height = this.fHeight;
      this.AfterResize();
      return Result;
    };
    this.OnRequestFrame = function (aTime) {
      this.GL.viewport(0,0,this.fWidth,this.fHeight);
      this.GL.clearColor(0,0,0,1);
      this.GL.enable(2929);
      this.GL.clear(16384 | 256);
      var $tmp = this.fState;
      if ($tmp === 1) {
        if (pas.resources.TResources.Completed()) {
          this.AfterLoad();
          this.fState = 2;
        };
      } else if ($tmp === 2) {
        this.Update(aTime);
        this.Render();
      };
      window.requestAnimationFrame(rtl.createCallback(this,"OnRequestFrame"));
    };
    this.GetElements = function () {
      var Result = null;
      Result = this.fElements;
      return Result;
    };
    this.InitializeResources = function () {
    };
    this.AfterLoad = function () {
    };
    this.AfterResize = function () {
    };
    this.DoMove = function (AX, AY) {
    };
    this.DoWheel = function (AX) {
    };
    this.DoStopDrag = function () {
    };
    this.DoStartDrag = function (AX, AY) {
    };
    this.DoClick = function (AX, AY, AButtons) {
    };
    this.DoKeyPress = function (AKeyCode) {
    };
    this.Update = function (ATimeMS) {
      var i = 0;
      var el = undefined;
      this.fAudio.Update(ATimeMS);
      for (var $in = this.GetElements(), $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        el = $in[$l];
        rtl.getObject(el).Update(this,ATimeMS);
      };
      for (var $l1 = 0, $end1 = this.fToFree.length - 1; $l1 <= $end1; $l1++) {
        i = $l1;
        rtl.getObject(this.fToFree[i]).$destroy("Destroy");
      };
      this.fToFree = new Array();
    };
    this.Render = function () {
      var $Self = this;
      var el = undefined;
      var toDraw = null;
      var opaque = null;
      var transparent = null;
      toDraw = this.GetElements().filter($impl.OnlyVisible);
      opaque = toDraw.filter(function (element, index, anArray) {
        var Result = false;
        Result = rtl.getObject(element).fOpaque;
        return Result;
      });
      for (var $in = opaque, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        el = $in[$l];
        rtl.getObject(el).Render(this.GL,this.Viewport);
      };
      if (true) this.GL.disable(2929);
      transparent = toDraw.filter(function (element, index, anArray) {
        var Result = false;
        Result = !rtl.getObject(element).fOpaque;
        return Result;
      });
      toDraw = transparent.sort(function (a, b) {
        var Result = 0;
        Result = Math.round(rtl.getObject(b).fPosition.Y - rtl.getObject(a).fPosition.Y);
        return Result;
      });
      for (var $in1 = toDraw, $l1 = 0, $end1 = rtl.length($in1) - 1; $l1 <= $end1; $l1++) {
        el = $in1[$l1];
        rtl.getObject(el).Render(this.GL,this.Viewport);
      };
      if (true) this.GL.enable(2929);
    };
    this.AddElement = function (AElement) {
      var Result = null;
      this.fElements.push(AElement);
      Result = AElement;
      return Result;
    };
    this.RemoveElement = function (AElement, AFreeLater) {
      var idx = 0;
      idx = this.fElements.indexOf(AElement);
      if (idx > -1) this.fElements.splice(idx,1);
      if (AFreeLater) this.fToFree.push(AElement);
    };
    this.Create$1 = function () {
      pas.System.TObject.Create.call(this);
      this.fAudio = pas.gameaudio.TGameAudio.$create("Create$1");
      this.fToFree = new Array();
      this.fState = 0;
      this.Viewport.Projection = pas.GameMath.TPMatrix.$create("Identity");
      this.Viewport.ModelView = pas.GameMath.TPMatrix.$create("Identity");
      this.fElements = new Array();
      this.Canvas = rtl.asExt(document.getElementById("c"),HTMLCanvasElement);
      this.GL = rtl.asExt(this.Canvas.getContext("webgl"),WebGLRenderingContext);
      this.GL.getExtension("OES_standard_derivatives");
      this.Canvas.onmousedown = rtl.createSafeCallback(this,"OnCanvasMouseDown");
      this.Canvas.onmouseup = rtl.createSafeCallback(this,"OnCanvasMouseUp");
      this.Canvas.onmousemove = rtl.createSafeCallback(this,"OnCanvasMove");
      this.Canvas.onwheel = rtl.createSafeCallback(this,"OnCanvasWheel");
      this.Canvas.onmouseleave = rtl.createSafeCallback(this,"OnCanvasLeave");
      window.addEventListener("keydown",rtl.createCallback(this,"OnCanvasKeyPress"));
      window.addEventListener("resize",rtl.createSafeCallback(this,"OnResize"));
      this.OnResize(null);
      return this;
    };
    this.Run = function () {
      this.InitializeResources();
      this.fState = 1;
      window.requestAnimationFrame(rtl.createCallback(this,"OnRequestFrame"));
    };
  });
  this.Game = function () {
    var Result = null;
    Result = $impl.GameInstance;
    return Result;
  };
  this.RunGame = function (AGame) {
    $impl.GameInstance = AGame.$create("Create$1");
    $impl.GameInstance.Run();
  };
  $mod.$implcode = function () {
    $impl.DragStart = 500;
    $impl.GameInstance = null;
    $impl.IsPowerOf2 = function (x) {
      var Result = false;
      Result = (x & (x - 1)) === 0;
      return Result;
    };
    $impl.OnlyVisible = function (element, index, anArray) {
      var Result = false;
      Result = rtl.getObject(element).fVisible;
      return Result;
    };
  };
},["resources"]);
rtl.module("resources",["System","Classes","SysUtils","Web","JS","GameBase"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass(this,"TResourceString",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fString = "";
    };
    this.SetText = function (AText) {
      this.fString = AText;
    };
  });
  rtl.createClass(this,"TResources",pas.System.TObject,function () {
    this.Loaded = function (Event) {
      var Result = false;
      var source = "";
      var el = undefined;
      source = "<unknown resource>";
      if (rtl.isExt(Event.target,Image)) {
        source = Event.target.src;
        var $in = $impl.Resources.GetEnumerator();
        try {
          while ($in.MoveNext()) {
            el = $in.GetCurrent();
            if (rtl.getObject(el).fObj == Event.target) rtl.getObject(rtl.getObject(el).fTargetObj).Load(Event.target);
          }
        } finally {
          $in = rtl.freeLoc($in)
        };
      };
      $impl.LoadedCount += 1;
      Result = true;
      return Result;
    };
    this.AddString = function (ASrc) {
      var Result = null;
      var res = undefined;
      var $in = $impl.Resources.GetEnumerator();
      try {
        while ($in.MoveNext()) {
          res = $in.GetCurrent();
          if (rtl.getObject(res).fSrc === ASrc) return rtl.getObject(rtl.getObject(res).fTargetObj);
        }
      } finally {
        $in = rtl.freeLoc($in)
      };
      Result = $mod.TResourceString.$create("Create");
      $impl.FetchBlob(ASrc,Result);
      $impl.Resources.Add($impl.TResource.$create("Create$1",[ASrc,Result,Result]));
      return Result;
    };
    this.AddImage = function (ASrc) {
      var Result = null;
      var res = undefined;
      var img = null;
      var $in = $impl.Resources.GetEnumerator();
      try {
        while ($in.MoveNext()) {
          res = $in.GetCurrent();
          if (rtl.getObject(res).fSrc === ASrc) return rtl.getObject(rtl.getObject(res).fTargetObj);
        }
      } finally {
        $in = rtl.freeLoc($in)
      };
      img = rtl.asExt(document.createElement("img"),Image);
      img.onload = rtl.createSafeCallback(this,"Loaded");
      img.src = ASrc;
      Result = $impl.TResourceTexture.$create("Create$1",[1,1]);
      $impl.Resources.Add($impl.TResource.$create("Create$1",[ASrc,img,Result]));
      return Result;
    };
    this.AddSound = function (ASrc) {
      var Result = null;
      var res = undefined;
      var $in = $impl.Resources.GetEnumerator();
      try {
        while ($in.MoveNext()) {
          res = $in.GetCurrent();
          if (rtl.getObject(res).fSrc === ASrc) return rtl.getObject(res).fTargetObj;
        }
      } finally {
        $in = rtl.freeLoc($in)
      };
      Result = rtl.asExt(document.createElement("audio"),HTMLAudioElement);
      Result.preload = "auto";
      Result.addEventListener("canplaythrough",rtl.createSafeCallback(this,"Loaded"));
      Result.src = ASrc;
      $impl.Resources.Add($impl.TResource.$create("Create$1",[ASrc,Result,Result]));
      return Result;
    };
    this.Completed = function () {
      var Result = false;
      Result = this.TotalLoaded() >= this.Total();
      return Result;
    };
    this.Total = function () {
      var Result = 0;
      Result = $impl.Resources.GetCount();
      return Result;
    };
    this.TotalLoaded = function () {
      var Result = 0;
      Result = $impl.LoadedCount;
      return Result;
    };
  });
  $mod.$implcode = function () {
    rtl.createClass($impl,"TResourceTexture",pas.GameBase.TGameTexture,function () {
      this.Create$1 = function (AWidth, AHeight) {
        pas.GameBase.TGameTexture.Create$1.call(this,AWidth,AHeight);
        return this;
      };
    });
    rtl.createClass($impl,"TResource",pas.System.TObject,function () {
      this.$init = function () {
        pas.System.TObject.$init.call(this);
        this.fTargetObj = undefined;
        this.fObj = undefined;
        this.fSrc = "";
      };
      this.Create$1 = function (ASrc, AObj, ATargetObj) {
        pas.System.TObject.Create.call(this);
        this.fSrc = ASrc;
        this.fObj = AObj;
        this.fTargetObj = ATargetObj;
        return this;
      };
      this.Destroy = function () {
        this.fObj = null;
        pas.System.TObject.Destroy.call(this);
      };
    });
    $impl.LoadedCount = 0;
    $impl.Resources = null;
    $impl.GetText = async function (ABlob) {
      return await ABlob.text();
    };
    $impl.FetchBlob = async function (ASrc, ADest) {
      var response = null;
      var myBlob = null;
      var s = "";
      try {
        response = await window.fetch(ASrc);
        if (!response.ok) {
          throw pas.SysUtils.Exception.$create("Create$1",["HTTP error! status: " + ("" + response.status)])}
         else {
          myBlob = await response.blob();
          if (rtl.isExt(ADest,$mod.TResourceString,1)) {
            s = await $impl.GetText(myBlob);
            rtl.getObject(ADest).SetText(s);
            $impl.LoadedCount += 1;
          };
        };
      } catch ($e) {
        window.console.log($e);
      };
    };
  };
  $mod.$init = function () {
    $impl.Resources = pas.Classes.TList.$create("Create$1");
  };
},[]);
rtl.module("guibase",["System","Web","webgl","GameBase","GameMath","Classes","SysUtils"],function () {
  "use strict";
  var $mod = this;
  rtl.recNewT(this,"TGUIPoint",function () {
    this.X = 0.0;
    this.Y = 0.0;
    this.$eq = function (b) {
      return (this.X === b.X) && (this.Y === b.Y);
    };
    this.$assign = function (s) {
      this.X = s.X;
      this.Y = s.Y;
      return this;
    };
    this.Create = function (AX, AY) {
      var Result = $mod.TGUIPoint.$new();
      Result.X = AX;
      Result.Y = AY;
      return Result;
    };
  });
  rtl.createClass(this,"TGUIElement",pas.GameBase.TGameElement,function () {
    this.$init = function () {
      pas.GameBase.TGameElement.$init.call(this);
      this.fHeight = 0;
      this.fHitTestVisible = false;
      this.fOnClick = null;
      this.fOnMouseEnter = null;
      this.fOnMouseLeave = null;
      this.fParent = null;
      this.fTag = 0;
      this.fVisible$1 = false;
      this.fWidth = 0;
      this.fChildren = null;
    };
    this.$final = function () {
      this.fOnClick = undefined;
      this.fOnMouseEnter = undefined;
      this.fOnMouseLeave = undefined;
      this.fParent = undefined;
      this.fChildren = undefined;
      pas.GameBase.TGameElement.$final.call(this);
    };
    this.GetChild = function (AIndex) {
      var Result = null;
      Result = rtl.getObject(this.fChildren.Get(AIndex));
      return Result;
    };
    this.GetChildCount = function () {
      var Result = 0;
      Result = this.fChildren.GetCount();
      return Result;
    };
    this.Render = function (AContext, AViewport) {
      var i = 0;
      var SubViewPort = pas.GameBase.TGameViewport.$new();
      SubViewPort.$assign(AViewport);
      SubViewPort.ModelView = AViewport.ModelView.Multiply$1(pas.GameMath.TPMatrix.$create("CreateTranslation",[this.fPosition.X,this.fPosition.Y,0]));
      for (var $l = 0, $end = this.fChildren.GetCount() - 1; $l <= $end; $l++) {
        i = $l;
        rtl.getObject(this.fChildren.Get(i)).Render(AContext,SubViewPort);
      };
    };
    this.NotifyRemovedSubchild = function (AChild) {
      if (this.fParent != null) this.fParent.NotifyRemovedSubchild(AChild);
    };
    this.DoMouseLeave = function (ACoord) {
      if (this.fOnMouseLeave != null) this.fOnMouseLeave(this,ACoord);
    };
    this.DoMouseEnter = function (ACoord) {
      if (this.fOnMouseEnter != null) this.fOnMouseEnter(this,ACoord);
    };
    this.HitTest = function (ACoord) {
      var Result = false;
      Result = this.fHitTestVisible && (ACoord.X >= this.fPosition.X) && (ACoord.Y >= this.fPosition.Y) && (ACoord.X < (this.fPosition.X + this.fWidth)) && (ACoord.Y < (this.fPosition.Y + this.fHeight));
      return Result;
    };
    this.HitChild = function (ACoord) {
      var Result = 0;
      var local = $mod.TGUIPoint.$new();
      var i = 0;
      Result = -1;
      if (this.fChildren.GetCount() > 0) {
        local.$assign(this.TranslateToLocal(ACoord));
        for (var $l = 0, $end = this.GetChildCount() - 1; $l <= $end; $l++) {
          i = $l;
          if (this.GetChild(i).HitTest($mod.TGUIPoint.$clone(local))) Result = i;
        };
      };
      return Result;
    };
    this.Create$2 = function () {
      pas.GameBase.TGameElement.Create$1.call(this,false);
      this.fChildren = pas.Classes.TList.$create("Create$1");
      this.fVisible$1 = true;
      this.fHitTestVisible = true;
      return this;
    };
    this.Destroy = function () {
      var i = 0;
      for (var $l = 0, $end = this.fChildren.GetCount() - 1; $l <= $end; $l++) {
        i = $l;
        rtl.getObject(this.fChildren.Get(i)).$destroy("Destroy");
      };
      rtl.free(this,"fChildren");
      pas.System.TObject.Destroy.call(this);
    };
    this.SetSize = function (AX, AY, AWidth, AHeight) {
      this.fPosition.$assign(pas.GameMath.TPVector.New(AX,AY,0));
      this.fWidth = AWidth;
      this.fHeight = AHeight;
    };
    this.DoClick = function (ACoord, AHandled) {
      var Hit = 0;
      AHandled.set(true);
      Hit = this.HitChild($mod.TGUIPoint.$clone(ACoord));
      if (Hit >= 0) {
        this.GetChild(Hit).DoClick($mod.TGUIPoint.$clone(this.TranslateToLocal(ACoord)),AHandled);
        if (AHandled.get()) return;
      };
      if (this.fOnClick != null) this.fOnClick(this,ACoord);
    };
    this.DoMove = function (ACoord, AHit, AControl) {
      var Hit = 0;
      AHit.set(true);
      AControl.set(this);
      Hit = this.HitChild($mod.TGUIPoint.$clone(ACoord));
      if (Hit >= 0) this.GetChild(Hit).DoMove($mod.TGUIPoint.$clone(this.TranslateToLocal(ACoord)),AHit,AControl);
    };
    this.TranslateToLocal = function (AGlobal) {
      var Result = $mod.TGUIPoint.$new();
      Result.$assign($mod.TGUIPoint.Create(AGlobal.X - this.fPosition.X,AGlobal.Y - this.fPosition.Y));
      return Result;
    };
    this.AddChild = function (AChild) {
      AChild.fParent = this;
      this.fChildren.Add(AChild);
    };
    this.RemoveChild = function (AChild) {
      this.NotifyRemovedSubchild(AChild);
      AChild.fParent = null;
      this.fChildren.Remove(AChild);
    };
  });
  rtl.createClass(this,"TGUI",this.TGUIElement,function () {
    this.$init = function () {
      $mod.TGUIElement.$init.call(this);
      this.fCurrentHover = null;
      this.Viewport = pas.GameBase.TGameViewport.$new();
    };
    this.$final = function () {
      this.fCurrentHover = undefined;
      this.Viewport = undefined;
      $mod.TGUIElement.$final.call(this);
    };
    this.NotifyRemovedSubchild = function (AChild) {
      if (AChild === this.fCurrentHover) this.fCurrentHover = null;
    };
    this.Render = function (AContext, AViewport) {
      this.DoRender(AContext);
    };
    this.Resize = function (AWidth, AHeight) {
      this.Viewport.Projection = pas.GameMath.TPMatrix.$create("Ortho",[0,AWidth,AHeight,0,-10,10]);
      this.Viewport.ModelView = pas.GameMath.TPMatrix.$create("Identity");
    };
    this.DoRender = function (AContext) {
      AContext.disable(2929);
      $mod.TGUIElement.Render.call(this,AContext,this.Viewport);
      AContext.enable(2929);
    };
    this.DoClick = function (ACoord, AHandled) {
      var Hit = 0;
      AHandled.set(false);
      Hit = this.HitChild($mod.TGUIPoint.$clone(ACoord));
      if (Hit >= 0) this.GetChild(Hit).DoClick($mod.TGUIPoint.$clone(this.TranslateToLocal(ACoord)),AHandled);
    };
    this.DoMove = function (ACoord, AHit, AControl) {
      var leaving = false;
      var entering = false;
      $mod.TGUIElement.DoMove.call(this,$mod.TGUIPoint.$clone(ACoord),AHit,AControl);
      leaving = !AHit.get() || ((AControl.get() !== this.fCurrentHover) && (this.fCurrentHover != null));
      entering = AHit.get() && (AControl.get() !== this.fCurrentHover);
      if (leaving && (this.fCurrentHover != null)) {
        this.fCurrentHover.DoMouseLeave(ACoord);
        this.fCurrentHover = null;
      };
      if (entering) {
        this.fCurrentHover = AControl.get();
        this.fCurrentHover.DoMouseEnter(ACoord);
      };
    };
  });
});
rtl.module("GameSprite",["System","JS","webgl","GameBase","GameMath","Classes","SysUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.recNewT(this,"TGameFrame",function () {
    this.Image = null;
    this.StartTime = 0.0;
    this.Last = false;
    this.$new = function () {
      var r = Object.create(this);
      r.Start = pas.GameMath.TPVector.$new();
      r.Stop = pas.GameMath.TPVector.$new();
      return r;
    };
    this.$eq = function (b) {
      return (this.Image === b.Image) && this.Start.$eq(b.Start) && this.Stop.$eq(b.Stop) && (this.StartTime === b.StartTime) && (this.Last === b.Last);
    };
    this.$assign = function (s) {
      this.Image = s.Image;
      this.Start.$assign(s.Start);
      this.Stop.$assign(s.Stop);
      this.StartTime = s.StartTime;
      this.Last = s.Last;
      return this;
    };
  });
  rtl.createClass(this,"TGameAnimation",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fName = "";
      this.fFrame = [];
      this.fLooptime = 0.0;
    };
    this.$final = function () {
      this.fFrame = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (AName) {
      pas.System.TObject.Create.call(this);
      this.fName = AName;
      this.fLooptime = 0;
      return this;
    };
    this.AddFrame = function (AImage, AStart, AStop, AFrameTime) {
      if (rtl.length(this.fFrame) > 0) this.fFrame[rtl.length(this.fFrame) - 1].Last = false;
      this.fFrame = rtl.arraySetLength(this.fFrame,$mod.TGameFrame,(rtl.length(this.fFrame) - 1) + 2);
      this.fFrame[rtl.length(this.fFrame) - 1].Image = AImage;
      this.fFrame[rtl.length(this.fFrame) - 1].Start.$assign(AStart.Multiply(pas.GameMath.TPVector.New(1 / AImage.fWidth,1 / AImage.fHeight,0)));
      this.fFrame[rtl.length(this.fFrame) - 1].Stop.$assign(AStop.Multiply(pas.GameMath.TPVector.New(1 / AImage.fWidth,1 / AImage.fHeight,0)));
      this.fFrame[rtl.length(this.fFrame) - 1].StartTime = this.fLooptime;
      this.fFrame[rtl.length(this.fFrame) - 1].Last = true;
      this.fLooptime = this.fLooptime + AFrameTime;
    };
    this.GetFrame = function (ATime, ALooping) {
      var Result = $mod.TGameFrame.$new();
      var best = 0;
      var i = 0;
      if (ALooping) ATime = ATime % this.fLooptime;
      best = rtl.length(this.fFrame) - 1;
      for (var $l = 0, $end = rtl.length(this.fFrame) - 1; $l <= $end; $l++) {
        i = $l;
        if (ATime > this.fFrame[i].StartTime) best = i;
      };
      Result.$assign(this.fFrame[best]);
      return Result;
    };
  });
  rtl.createClass(this,"TGameSprite",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fWidth = 0;
      this.fHeight = 0;
      this.fName = "";
      this.fAnimations = null;
    };
    this.$final = function () {
      this.fAnimations = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.CreateJSON = function (AInfo) {
      var x = 0;
      var y = 0;
      var idx = 0;
      var XCount = 0;
      var texture = null;
      var animations = "";
      var obj = null;
      var anim = null;
      var frame = undefined;
      var time = 0.0;
      pas.System.TObject.Create.call(this);
      this.fAnimations = new Map();
      this.fName = "" + AInfo["name"];
      this.fWidth = rtl.trunc(AInfo["tile-width"]);
      this.fHeight = rtl.trunc(AInfo["tile-height"]);
      texture = pas.resources.TResources.AddImage("" + AInfo["texture"]);
      XCount = rtl.trunc(texture.fWidth / this.fWidth);
      for (var $in = Object.keys(AInfo["animations"]), $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        animations = $in[$l];
        obj = AInfo["animations"][animations];
        anim = $mod.TGameAnimation.$create("Create$1",[animations]);
        this.fAnimations.set(animations,anim);
        for (var $in1 = obj, $l1 = 0, $end1 = rtl.length($in1) - 1; $l1 <= $end1; $l1++) {
          frame = $in1[$l1];
          idx = rtl.trunc(frame["frame"]);
          time = rtl.getNumber(frame["time"]);
          x = idx % XCount;
          y = rtl.trunc(idx / XCount);
          anim.AddFrame(texture,pas.GameMath.TPVector.$clone(pas.GameMath.TPVector.New(x * this.fWidth,y * this.fHeight,0)),pas.GameMath.TPVector.$clone(pas.GameMath.TPVector.New((x + 1) * this.fWidth,(y + 1) * this.fHeight,0)),time);
        };
      };
      return this;
    };
    this.GetAnimation = function (AAnimation) {
      var Result = null;
      Result = rtl.getObject(this.fAnimations.get(AAnimation));
      return Result;
    };
    this.GetFrame = function (AAnimation, ATime, ALooping) {
      var Result = $mod.TGameFrame.$new();
      var anim = null;
      anim = rtl.getObject(this.fAnimations.get(AAnimation));
      Result.$assign(anim.GetFrame(ATime,ALooping));
      return Result;
    };
  });
  this.TGameQuad$clone = function (a) {
    var b = [];
    b.length = 4;
    for (var c = 0; c < 4; c++) b[c] = pas.GameMath.TPVector.$clone(a[c]);
    return b;
  };
  this.AddSprites = function (AJson) {
    var s = null;
    var fInfo = null;
    var info = undefined;
    fInfo = JSON.parse(AJson);
    for (var $in = fInfo, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
      info = $in[$l];
      s = $mod.TGameSprite.$create("CreateJSON",[info]);
      $impl.Sprites.set(s.fName,s);
    };
  };
  this.GetSprite = function (AName) {
    var Result = null;
    Result = rtl.getObject($impl.Sprites.get(AName));
    return Result;
  };
  this.RenderFrame = function (GL, AViewport, AQuad, AFrame) {
    var i = 0;
    var i2 = 0;
    var vertices = null;
    var indices = null;
    var texLoc = null;
    var pmLoc = null;
    var mmLoc = null;
    var vc = 0;
    $impl.AllocateStuff(GL);
    GL.enable(3042);
    GL.blendFunc(770,771);
    vertices = new Float32Array(4 * (3 + 2));
    indices = new Uint16Array(2 * 3);
    for (i2 = 0; i2 <= 3; i2++) {
      vertices[(i2 * 5) + 0] = AQuad[i2].X;
      vertices[(i2 * 5) + 1] = AQuad[i2].Y;
      vertices[(i2 * 5) + 2] = AQuad[i2].Z;
    };
    vertices[(0 * 5) + 3] = AFrame.Start.X;
    vertices[(0 * 5) + 4] = AFrame.Start.Y;
    vertices[(1 * 5) + 3] = AFrame.Stop.X;
    vertices[(1 * 5) + 4] = AFrame.Start.Y;
    vertices[(2 * 5) + 3] = AFrame.Stop.X;
    vertices[(2 * 5) + 4] = AFrame.Stop.Y;
    vertices[(3 * 5) + 3] = AFrame.Start.X;
    vertices[(3 * 5) + 4] = AFrame.Stop.Y;
    indices.set([(4 * i) + 0,(4 * i) + 1,(4 * i) + 2,(4 * i) + 2,(4 * i) + 3,(4 * i) + 0],0);
    GL.bindBuffer(34962,$impl.Buffer);
    GL.bufferData(34962,vertices,35044);
    GL.bindBuffer(34962,null);
    GL.bindBuffer(34963,$impl.Elements);
    GL.bufferData(34963,indices,35044);
    GL.bindBuffer(34963,null);
    GL.useProgram($impl.Shader.fProg);
    GL.bindBuffer(34962,$impl.Buffer);
    GL.bindBuffer(34963,$impl.Elements);
    texLoc = GL.getUniformLocation($impl.Shader.fProg,"map");
    GL.activeTexture(33984);
    GL.bindTexture(3553,AFrame.Image.fID);
    GL.uniform1i(texLoc,0);
    pmLoc = GL.getUniformLocation($impl.Shader.fProg,"projectionMatrix");
    mmLoc = GL.getUniformLocation($impl.Shader.fProg,"modelViewMatrix");
    GL.uniformMatrix4fv(pmLoc,false,AViewport.Projection.V);
    GL.uniformMatrix4fv(mmLoc,false,AViewport.ModelView.V);
    vc = GL.getAttribLocation($impl.Shader.fProg,"position");
    GL.vertexAttribPointer(vc,3,5126,false,20,0);
    GL.enableVertexAttribArray(vc);
    vc = GL.getAttribLocation($impl.Shader.fProg,"uv");
    GL.vertexAttribPointer(vc,2,5126,false,20,12);
    GL.enableVertexAttribArray(vc);
    GL.drawElements(4,2 * 3,5123,0);
    GL.disable(3042);
  };
  this.RenderQuad = function (GL, AViewport, AQuad, AColor) {
    var i = 0;
    var i2 = 0;
    var vertices = null;
    var indices = null;
    var colorLoc = null;
    var pmLoc = null;
    var mmLoc = null;
    var vc = 0;
    $impl.AllocateStuff(GL);
    GL.enable(3042);
    GL.blendFunc(770,771);
    vertices = new Float32Array(4 * 3);
    indices = new Uint16Array(2 * 3);
    for (i2 = 0; i2 <= 3; i2++) {
      vertices[(i2 * 3) + 0] = AQuad[i2].X;
      vertices[(i2 * 3) + 1] = AQuad[i2].Y;
      vertices[(i2 * 3) + 2] = AQuad[i2].Z;
    };
    indices.set([(4 * i) + 0,(4 * i) + 1,(4 * i) + 2,(4 * i) + 2,(4 * i) + 3,(4 * i) + 0],0);
    GL.bindBuffer(34962,$impl.Buffer);
    GL.bufferData(34962,vertices,35044);
    GL.bindBuffer(34962,null);
    GL.bindBuffer(34963,$impl.Elements);
    GL.bufferData(34963,indices,35044);
    GL.bindBuffer(34963,null);
    GL.useProgram($impl.ColorShader.fProg);
    GL.bindBuffer(34962,$impl.Buffer);
    GL.bindBuffer(34963,$impl.Elements);
    colorLoc = GL.getUniformLocation($impl.ColorShader.fProg,"color");
    GL.uniform4f(colorLoc,AColor.R,AColor.G,AColor.B,AColor.A);
    pmLoc = GL.getUniformLocation($impl.ColorShader.fProg,"projectionMatrix");
    mmLoc = GL.getUniformLocation($impl.ColorShader.fProg,"modelViewMatrix");
    GL.uniformMatrix4fv(pmLoc,false,AViewport.Projection.V);
    GL.uniformMatrix4fv(mmLoc,false,AViewport.ModelView.V);
    vc = GL.getAttribLocation($impl.ColorShader.fProg,"position");
    GL.vertexAttribPointer(vc,3,5126,false,0,0);
    GL.enableVertexAttribArray(vc);
    GL.drawElements(4,2 * 3,5123,0);
    GL.disable(3042);
  };
  $mod.$implcode = function () {
    $impl.Sprites = null;
    $impl.BuffersAllocated = false;
    $impl.Buffer = null;
    $impl.Elements = null;
    $impl.Shader = null;
    $impl.ColorShader = null;
    $impl.AllocateStuff = function (GL) {
      if ($impl.BuffersAllocated) return;
      $impl.BuffersAllocated = true;
      $impl.Buffer = GL.createBuffer();
      $impl.Elements = GL.createBuffer();
      $impl.Shader = pas.GameBase.TGameShader.$create("Create$1",["attribute vec3 position;" + "attribute vec2 uv;" + "uniform mat4 projectionMatrix;" + "uniform mat4 modelViewMatrix;" + "varying vec2 texCoord;" + "void main(void){ texCoord = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }","precision mediump float;" + "varying vec2 texCoord;" + "uniform sampler2D map;" + "void main(void) {" + "  gl_FragColor = texture2D(map, texCoord).rgba;" + "}"]);
      $impl.ColorShader = pas.GameBase.TGameShader.$create("Create$1",["attribute vec3 position;" + "uniform mat4 projectionMatrix;" + "uniform mat4 modelViewMatrix;" + "void main(void){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }","precision mediump float;" + "uniform vec4 color;" + "void main(void) {" + "  gl_FragColor = color;" + "}"]);
    };
  };
  $mod.$init = function () {
    $impl.Sprites = new Map();
  };
},["resources"]);
rtl.module("GameFont",["System","Classes","SysUtils","Math","JS","Web","webgl","GameBase","GameMath"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.recNewT(this,"TQuad",function () {
    this.$new = function () {
      var r = Object.create(this);
      r.P = rtl.arraySetLength(null,0.0,12);
      r.texCoords = rtl.arraySetLength(null,0.0,8);
      return r;
    };
    this.$eq = function (b) {
      return rtl.arrayEq(this.P,b.P) && rtl.arrayEq(this.texCoords,b.texCoords);
    };
    this.$assign = function (s) {
      this.P = s.P.slice(0);
      this.texCoords = s.texCoords.slice(0);
      return this;
    };
  });
  rtl.recNewT(this,"TTextRun",function () {
    this.X = 0.0;
    this.Y = 0.0;
    this.Width = 0.0;
    this.Height = 0.0;
    this.LineHeight = 0.0;
    this.Texture = null;
    this.Text = "";
    this.$new = function () {
      var r = Object.create(this);
      r.Quads = [];
      return r;
    };
    this.$eq = function (b) {
      return (this.X === b.X) && (this.Y === b.Y) && (this.Width === b.Width) && (this.Height === b.Height) && (this.LineHeight === b.LineHeight) && (this.Texture === b.Texture) && (this.Quads === b.Quads) && (this.Text === b.Text);
    };
    this.$assign = function (s) {
      this.X = s.X;
      this.Y = s.Y;
      this.Width = s.Width;
      this.Height = s.Height;
      this.LineHeight = s.LineHeight;
      this.Texture = s.Texture;
      this.Quads = rtl.arrayRef(s.Quads);
      this.Text = s.Text;
      return this;
    };
  });
  rtl.createClass(this,"TGameFont",pas.System.TObject,function () {
    this.fBuffersAllocated = false;
    this.fBuffer = null;
    this.fIndices = null;
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fInfo = null;
      this.fPadding = null;
      this.fTexture = null;
      this.fBase = 0;
      this.fLineHeight = 0;
    };
    this.$final = function () {
      this.fInfo = undefined;
      this.fPadding = undefined;
      this.fTexture = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.DoAllocate = function (gl) {
      if (!this.fBuffersAllocated) {
        $mod.TGameFont.fBuffersAllocated = true;
        $mod.TGameFont.fBuffer = gl.createBuffer();
        $mod.TGameFont.fIndices = gl.createBuffer();
      };
    };
    this.FindChar = function (c) {
      var Result = null;
      var el = undefined;
      for (var $in = this.fInfo["chars"], $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        el = $in[$l];
        if (el["char"] == c) return el;
      };
      Result = null;
      return Result;
    };
    this.FindKerning = function (APrev, ACurrent) {
      var Result = 0;
      var el = undefined;
      for (var $in = this.fInfo["kernings"], $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        el = $in[$l];
        if ((el["first"] == APrev) && (el["second"] == ACurrent)) return rtl.trunc(el["amount"]);
      };
      Result = 0;
      return Result;
    };
    this.Create$1 = function (ASrcInfo, ASrcImage) {
      pas.System.TObject.Create.call(this);
      this.fInfo = JSON.parse(ASrcInfo);
      this.fTexture = ASrcImage;
      this.fPadding = this.fInfo["info"]["padding"];
      this.fBase = rtl.trunc(this.fInfo["common"]["base"]);
      this.fLineHeight = rtl.trunc(this.fInfo["common"]["lineHeight"]);
      if ($impl.MSDFShader === null) $impl.MSDFShader = pas.GameBase.TGameShader.$create("Create$1",[$impl.VertShader,$impl.FragShader]);
      return this;
    };
    this.Draw = function (AStr) {
      var $Self = this;
      var Result = $mod.TTextRun.$new();
      var res = null;
      var c = "";
      var prevID = 0;
      var x = 0;
      var xadv = 0;
      var width = 0;
      var idx = 0;
      var xoffset = 0;
      var yoffset = 0;
      var tx = 0;
      var ty = 0;
      var height = 0;
      var delta = 0;
      var y = 0;
      var TexScaling = 0.0;
      function Quad(X, Y, W, H, TX, TY, TW, TH) {
        var Result = $mod.TQuad.$new();
        Result.P[(0 * 3) + 0] = X;
        Result.P[(0 * 3) + 1] = Y;
        Result.P[(0 * 3) + 2] = 0;
        Result.P[(1 * 3) + 0] = X + W;
        Result.P[(1 * 3) + 1] = Y;
        Result.P[(1 * 3) + 2] = 0;
        Result.P[(2 * 3) + 0] = X + W;
        Result.P[(2 * 3) + 1] = Y + H;
        Result.P[(2 * 3) + 2] = 0;
        Result.P[(3 * 3) + 0] = X;
        Result.P[(3 * 3) + 1] = Y + H;
        Result.P[(3 * 3) + 2] = 0;
        Result.texCoords[(0 * 2) + 0] = TX;
        Result.texCoords[(0 * 2) + 1] = TY;
        Result.texCoords[(1 * 2) + 0] = TX + TW;
        Result.texCoords[(1 * 2) + 1] = TY;
        Result.texCoords[(2 * 2) + 0] = TX + TW;
        Result.texCoords[(2 * 2) + 1] = TY + TH;
        Result.texCoords[(3 * 2) + 0] = TX;
        Result.texCoords[(3 * 2) + 1] = TY + TH;
        return Result;
      };
      Result.Width = 0;
      Result.Height = this.fLineHeight;
      Result.LineHeight = this.fLineHeight;
      Result.Texture = this.fTexture;
      Result.Text = AStr;
      Result.Quads = rtl.arraySetLength(Result.Quads,$mod.TQuad,AStr.length);
      TexScaling = 1 / this.fTexture.fWidth;
      prevID = -1;
      x = 0;
      y = 0;
      idx = 0;
      for (var $in = AStr, $l = 0, $end = $in.length - 1; $l <= $end; $l++) {
        c = $in.charAt($l);
        if (c === "\r") continue;
        if (c === "\n") {
          Result.Width = Math.max(Result.Width,x + delta);
          Result.Height = Result.Height + this.fLineHeight;
          y = y + this.fLineHeight;
          x = 0;
          delta = 0;
          continue;
        };
        res = this.FindChar(c);
        if (res === null) return Result;
        xadv = rtl.trunc(res["xadvance"]);
        xoffset = rtl.trunc(res["xoffset"]);
        yoffset = rtl.trunc(res["yoffset"]);
        tx = rtl.trunc(res["x"]);
        ty = rtl.trunc(res["y"]);
        width = rtl.trunc(res["width"]);
        height = rtl.trunc(res["height"]);
        Result.Quads[idx].$assign(Quad(x + xoffset,y + yoffset,width,height,tx * TexScaling,ty * TexScaling,width * TexScaling,height * TexScaling));
        delta = width - xadv;
        x = x + this.FindKerning(prevID,rtl.trunc(res["id"])) + xadv;
        idx += 1;
      };
      Result.X = -rtl.getNumber(this.fPadding[3]);
      Result.Y = -rtl.getNumber(this.fPadding[0]);
      Result.Height = Result.Height + rtl.getNumber(this.fPadding[0]) + rtl.getNumber(this.fPadding[2]);
      Result.Width = Math.max(Result.Width,x + delta) + rtl.getNumber(this.fPadding[1]) + rtl.getNumber(this.fPadding[3]);
      return Result;
    };
    this.Render = function (GL, res, AViewport, AColor, AOpacity) {
      var i = 0;
      var i2 = 0;
      var vertices = null;
      var indices = null;
      var texLoc = null;
      var pmLoc = null;
      var mmLoc = null;
      var vc = 0;
      this.DoAllocate(GL);
      GL.enable(3042);
      GL.blendFunc(770,771);
      vertices = new Float32Array(4 * (3 + 2) * rtl.length(res.Quads));
      indices = new Uint16Array(2 * 3 * rtl.length(res.Quads));
      for (var $l = 0, $end = rtl.length(res.Quads) - 1; $l <= $end; $l++) {
        i = $l;
        for (i2 = 0; i2 <= 3; i2++) {
          vertices[(i * 4 * (3 + 2)) + (i2 * 5) + 0] = res.Quads[i].P[(i2 * 3) + 0];
          vertices[(i * 4 * (3 + 2)) + (i2 * 5) + 1] = res.Quads[i].P[(i2 * 3) + 1];
          vertices[(i * 4 * (3 + 2)) + (i2 * 5) + 2] = res.Quads[i].P[(i2 * 3) + 2];
          vertices[(i * 4 * (3 + 2)) + (i2 * 5) + 3] = res.Quads[i].texCoords[(i2 * 2) + 0];
          vertices[(i * 4 * (3 + 2)) + (i2 * 5) + 4] = res.Quads[i].texCoords[(i2 * 2) + 1];
        };
        indices.set([(4 * i) + 0,(4 * i) + 1,(4 * i) + 2,(4 * i) + 2,(4 * i) + 3,(4 * i) + 0],2 * 3 * i);
      };
      GL.bindBuffer(34962,this.fBuffer);
      GL.bufferData(34962,vertices,35044);
      GL.bindBuffer(34962,null);
      GL.bindBuffer(34963,this.fIndices);
      GL.bufferData(34963,indices,35044);
      GL.bindBuffer(34963,null);
      GL.useProgram($impl.MSDFShader.fProg);
      GL.bindBuffer(34962,this.fBuffer);
      GL.bindBuffer(34963,this.fIndices);
      texLoc = GL.getUniformLocation($impl.MSDFShader.fProg,"map");
      GL.uniform1f(GL.getUniformLocation($impl.MSDFShader.fProg,"opacity"),AOpacity);
      GL.uniform3f(GL.getUniformLocation($impl.MSDFShader.fProg,"color"),AColor.R,AColor.G,AColor.B);
      GL.activeTexture(33984);
      GL.bindTexture(3553,res.Texture.fID);
      GL.uniform1i(texLoc,0);
      pmLoc = GL.getUniformLocation($impl.MSDFShader.fProg,"projectionMatrix");
      mmLoc = GL.getUniformLocation($impl.MSDFShader.fProg,"modelViewMatrix");
      GL.uniformMatrix4fv(pmLoc,false,AViewport.Projection.V);
      GL.uniformMatrix4fv(mmLoc,false,AViewport.ModelView.V);
      vc = GL.getAttribLocation($impl.MSDFShader.fProg,"position");
      GL.vertexAttribPointer(vc,3,5126,false,20,0);
      GL.enableVertexAttribArray(vc);
      vc = GL.getAttribLocation($impl.MSDFShader.fProg,"uv");
      GL.vertexAttribPointer(vc,2,5126,false,20,12);
      GL.enableVertexAttribArray(vc);
      GL.drawElements(4,2 * 3 * rtl.length(res.Quads),5123,0);
      GL.disable(3042);
    };
  });
  this.LoadFont = function (AName, ASrcInfo, ASrcImage) {
    $impl.Fonts.set(AName,$mod.TGameFont.$create("Create$1",[ASrcInfo,ASrcImage]));
  };
  this.GetFont = function (AName) {
    var Result = null;
    Result = rtl.getObject($impl.Fonts.get(AName));
    return Result;
  };
  $mod.$implcode = function () {
    $impl.VertShader = "attribute vec2 uv;" + "attribute vec3 position;" + "uniform mat4 projectionMatrix;" + "uniform mat4 modelViewMatrix;" + "varying vec2 vUv;" + "void main() {" + "  vUv = uv;" + "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);" + "}";
    $impl.FragShader = "#ifdef GL_OES_standard_derivatives\r\n" + "#extension GL_OES_standard_derivatives : enable\r\n" + "#endif\r\n" + "precision highp float;" + "uniform float opacity;" + "uniform vec3 color;" + "uniform sampler2D map;" + "varying vec2 vUv;" + "float median(float r, float g, float b) { return max(min(r, g), min(max(r, g), b)); }" + "void main() {" + "  vec3 sample = texture2D(map, vUv).rgb;" + "  float sigDist = median(sample.r, sample.g, sample.b) - 0.5;" + "  float alpha = clamp(sigDist\/fwidth(sigDist) + 0.5, 0.0, 1.0);" + "  gl_FragColor = vec4(color.xyz, alpha * opacity);" + "  if (gl_FragColor.a < 0.0001) discard;" + "}";
    $impl.MSDFShader = null;
    $impl.Fonts = null;
  };
  $mod.$init = function () {
    $mod.TGameFont.fBuffersAllocated = false;
    $impl.Fonts = new Map();
  };
},[]);
rtl.module("guictrls",["System","GameBase","GameSprite","GameMath","GameFont","guibase","Web","webgl","JS"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass(this,"TGUIImage",pas.guibase.TGUIElement,function () {
    this.$init = function () {
      pas.guibase.TGUIElement.$init.call(this);
      this.fAnimation = "";
      this.fSprite = null;
      this.fTime = 0.0;
    };
    this.$final = function () {
      this.fSprite = undefined;
      pas.guibase.TGUIElement.$final.call(this);
    };
    this.Update = function (AGame, ATimeMS) {
      this.fTime = ATimeMS / 1000;
      pas.GameBase.TGameElement.Update.call(this,AGame,ATimeMS);
    };
    this.Render = function (AContext, AViewport) {
      if (this.fSprite !== null) pas.GameSprite.RenderFrame(AContext,AViewport,$impl.GetScreenQuad(pas.GameMath.TPVector.$clone(this.fPosition),this.fWidth,this.fHeight),this.fSprite.GetFrame(this.fAnimation,this.fTime,true));
      pas.guibase.TGUIElement.Render.call(this,AContext,AViewport);
    };
  });
  rtl.createClass(this,"TGUIPanel",pas.guibase.TGUIElement,function () {
    this.$init = function () {
      pas.guibase.TGUIElement.$init.call(this);
      this.fBackGround = pas.GameBase.TGameColor.$new();
    };
    this.$final = function () {
      this.fBackGround = undefined;
      pas.guibase.TGUIElement.$final.call(this);
    };
    this.Render = function (AContext, AViewport) {
      pas.GameSprite.RenderQuad(AContext,AViewport,$impl.GetScreenQuad(pas.GameMath.TPVector.$clone(this.fPosition),this.fWidth,this.fHeight),this.fBackGround);
      pas.guibase.TGUIElement.Render.call(this,AContext,AViewport);
    };
    this.Create$3 = function () {
      pas.guibase.TGUIElement.Create$2.call(this);
      this.fBackGround.$assign(pas.GameBase.TGameColor.New(0,0,0,1.0));
      return this;
    };
  });
  this.TGUILabelVAlign = {"0": "vaTop", vaTop: 0, "1": "vaMiddle", vaMiddle: 1, "2": "vaBottom", vaBottom: 2};
  this.TGUILabelHAlign = {"0": "haLeft", haLeft: 0, "1": "haMiddle", haMiddle: 1, "2": "haRight", haRight: 2};
  rtl.createClass(this,"TGUILabel",pas.guibase.TGUIElement,function () {
    this.$init = function () {
      pas.guibase.TGUIElement.$init.call(this);
      this.fCaption = "";
      this.fColor = pas.GameBase.TGameColor.$new();
      this.fFont = "";
      this.fHAlign = 0;
      this.fSize = 0;
      this.fVAlign = 0;
      this.fTextRun = pas.GameFont.TTextRun.$new();
    };
    this.$final = function () {
      this.fColor = undefined;
      this.fTextRun = undefined;
      pas.guibase.TGUIElement.$final.call(this);
    };
    this.Redraw = function () {
      this.fTextRun.$assign(pas.GameFont.GetFont(this.fFont).Draw(this.fCaption));
    };
    this.SetCaption = function (AValue) {
      if (this.fCaption === AValue) return;
      this.fCaption = AValue;
      this.Redraw();
    };
    this.SetFont = function (AValue) {
      if (this.fFont === AValue) return;
      this.fFont = AValue;
      this.Redraw();
    };
    this.SetFontSize = function (AValue) {
      if (this.fSize === AValue) return;
      this.fSize = AValue;
      this.Redraw();
    };
    this.Render = function (AContext, AViewport) {
      var SubViewPort = pas.GameBase.TGameViewport.$new();
      var H = 0.0;
      var Scaling = 0.0;
      H = this.fTextRun.LineHeight - this.fTextRun.Y;
      Scaling = this.fSize / H;
      SubViewPort.$assign(AViewport);
      SubViewPort.ModelView = pas.GameMath.TPMatrix.$create("CreateTranslation",[-this.fTextRun.X,-this.fTextRun.Y,0]).Multiply$1(pas.GameMath.TPMatrix.$create("CreateScale",[Scaling,Scaling,1])).Multiply$1(AViewport.ModelView).Multiply$1(pas.GameMath.TPMatrix.$create("CreateTranslation",[this.fPosition.X,this.fPosition.Y,0]));
      pas.GameFont.TGameFont.Render(AContext,pas.GameFont.TTextRun.$clone(this.fTextRun),pas.GameBase.TGameViewport.$clone(SubViewPort),pas.GameBase.TGameColor.$clone(this.fColor),this.fColor.A);
      pas.guibase.TGUIElement.Render.call(this,AContext,AViewport);
    };
    this.Create$3 = function () {
      pas.guibase.TGUIElement.Create$2.call(this);
      this.fColor.$assign(pas.GameBase.TGameColor.New(0,0,0,1.0));
      this.fFont = "sans";
      this.fSize = 12;
      this.fVAlign = 1;
      this.fHAlign = 1;
      return this;
    };
  });
  rtl.createClass(this,"TGUIInventoryItem",this.TGUIPanel,function () {
    this.$init = function () {
      $mod.TGUIPanel.$init.call(this);
      this.fHoverColor = pas.GameBase.TGameColor.$new();
      this.fItem = null;
      this.fItems = 0;
      this.fAnimation = "";
      this.fLabel = null;
    };
    this.$final = function () {
      this.fHoverColor = undefined;
      this.fItem = undefined;
      this.fLabel = undefined;
      $mod.TGUIPanel.$final.call(this);
    };
    this.SetItems = function (AValue) {
      if (this.fItems === AValue) return;
      this.fItems = AValue;
      this.fLabel.SetCaption(pas.SysUtils.IntToStr(AValue));
    };
    this.Render = function (AContext, AViewport) {
      $mod.TGUIPanel.Render.call(this,AContext,AViewport);
      pas.GameSprite.RenderFrame(AContext,AViewport,$impl.GetScreenQuad(pas.GameMath.TPVector.$clone(this.fPosition),this.fHeight,this.fHeight),this.fItem.GetFrame(this.fAnimation,0,true));
    };
    this.DoMouseEnter = function (ACoord) {
      pas.guibase.TGUIElement.DoMouseEnter.call(this,ACoord);
      this.fBackGround.$assign(this.fHoverColor);
    };
    this.DoMouseLeave = function (ACoord) {
      this.fBackGround.$assign(pas.GameBase.TGameColor.Transparent());
      pas.guibase.TGUIElement.DoMouseLeave.call(this,ACoord);
    };
    this.SetSize = function (AX, AY, AWidth, AHeight) {
      pas.guibase.TGUIElement.SetSize.call(this,AX,AY,AWidth,AHeight);
      this.fLabel.SetFontSize(this.fHeight);
      this.fLabel.SetSize(this.fHeight,0,10000,this.fHeight);
    };
    this.Create$4 = function (AItem, AAnimation) {
      $mod.TGUIPanel.Create$3.call(this);
      this.fHoverColor.$assign(pas.GameBase.TGameColor.Transparent());
      this.fBackGround.$assign(pas.GameBase.TGameColor.Transparent());
      this.fItem = AItem;
      this.fItems = 0;
      this.fAnimation = AAnimation;
      this.fLabel = $mod.TGUILabel.$create("Create$3");
      this.AddChild(this.fLabel);
      this.fLabel.fHitTestVisible = false;
      this.fLabel.SetSize(this.fHeight,0,10000,this.fHeight);
      this.fLabel.SetCaption("0");
      return this;
    };
  });
  rtl.createClass(this,"TGUIInventory",pas.guibase.TGUIElement,function () {
    this.$init = function () {
      pas.guibase.TGUIElement.$init.call(this);
      this.fHoverColor = pas.GameBase.TGameColor.$new();
      this.fItemHeight = 0;
      this.fItems = null;
      this.fItemWidth = 0;
      this.fOnClickItem = null;
      this.fChanged = false;
    };
    this.$final = function () {
      this.fHoverColor = undefined;
      this.fItems = undefined;
      this.fOnClickItem = undefined;
      pas.guibase.TGUIElement.$final.call(this);
    };
    this.ClickItem = function (ATarget, APosition) {
      if (this.fOnClickItem != null) this.fOnClickItem(ATarget.fItem);
    };
    this.RepackItems = function () {
      var x = 0;
      var y = 0;
      var el = undefined;
      var e = null;
      x = 0;
      y = 0;
      for (var $in = this.fItems, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        el = $in[$l];
        e = rtl.getObject(el);
        e.SetSize(x,y,this.fItemWidth,this.fItemHeight);
        x = x + this.fItemWidth;
        if (((x + this.fItemWidth) - 1) >= this.fWidth) {
          y += this.fItemHeight;
          x = 0;
        };
      };
    };
    this.Render = function (AContext, AViewport) {
      var el = undefined;
      var e = null;
      var toFree = null;
      var idx = 0;
      if (this.fChanged) {
        toFree = new Array();
        for (var $in = this.fItems, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
          el = $in[$l];
          e = rtl.getObject(el);
          if (e.fItems <= 0) {
            toFree.push(el);
            this.RemoveChild(e);
          };
        };
        for (var $in1 = toFree, $l1 = 0, $end1 = rtl.length($in1) - 1; $l1 <= $end1; $l1++) {
          el = $in1[$l1];
          idx = this.fItems.indexOf(el);
          this.fItems.splice(idx,1);
          e = rtl.getObject(el);
          e = rtl.freeLoc(e);
        };
        this.RepackItems();
        this.fChanged = false;
      };
      pas.guibase.TGUIElement.Render.call(this,AContext,AViewport);
    };
    this.Create$3 = function () {
      pas.guibase.TGUIElement.Create$2.call(this);
      this.fItems = new Array();
      this.fItemHeight = 35;
      this.fItemWidth = 70;
      return this;
    };
    this.AddElements = function (AItem, ACount) {
      var el = undefined;
      var e = null;
      for (var $in = this.fItems, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        el = $in[$l];
        e = rtl.getObject(el);
        if (e.fItem === AItem) {
          e.SetItems(e.fItems + ACount);
          return;
        };
      };
      e = $mod.TGUIInventoryItem.$create("Create$4",[AItem,"idle"]);
      e.SetItems(ACount);
      e.fOnClick = rtl.createCallback(this,"ClickItem");
      e.fHoverColor.$assign(this.fHoverColor);
      this.fItems.push(e);
      this.AddChild(e);
      this.fChanged = true;
    };
    this.RemoveElements = function (AItem, ACount) {
      var Result = false;
      var el = undefined;
      var e = null;
      for (var $in = this.fItems, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        el = $in[$l];
        e = rtl.getObject(el);
        if (e.fItem === AItem) {
          if (e.fItems >= ACount) {
            e.SetItems(e.fItems - ACount);
            this.fChanged = true;
            return true;
          } else return false;
        };
      };
      return Result;
    };
    this.ElementCount = function (AItem) {
      var Result = 0;
      var el = undefined;
      var e = null;
      for (var $in = this.fItems, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        el = $in[$l];
        e = rtl.getObject(el);
        if (e.fItem === AItem) return e.fItems;
      };
      Result = 0;
      return Result;
    };
  });
  rtl.createClass(this,"TGUIDialogOption",this.TGUIPanel,function () {
    this.$init = function () {
      $mod.TGUIPanel.$init.call(this);
      this.fIndex = 0;
      this.fHoverColor = pas.GameBase.TGameColor.$new();
      this.fText = "";
      this.fLabel = null;
    };
    this.$final = function () {
      this.fHoverColor = undefined;
      this.fLabel = undefined;
      $mod.TGUIPanel.$final.call(this);
    };
    this.Render = function (AContext, AViewport) {
      $mod.TGUIPanel.Render.call(this,AContext,AViewport);
      pas.GameSprite.RenderFrame(AContext,AViewport,$impl.GetScreenQuad(pas.GameMath.TPVector.$clone(this.fPosition),this.fHeight,this.fHeight),pas.GameSprite.GetSprite("icon-bullet").GetFrame("idle",0,true));
    };
    this.DoMouseEnter = function (ACoord) {
      pas.guibase.TGUIElement.DoMouseEnter.call(this,ACoord);
      this.fBackGround.$assign(this.fHoverColor);
    };
    this.DoMouseLeave = function (ACoord) {
      this.fBackGround.$assign(pas.GameBase.TGameColor.Transparent());
      pas.guibase.TGUIElement.DoMouseLeave.call(this,ACoord);
    };
    this.Create$4 = function (AIndex, AText) {
      $mod.TGUIPanel.Create$3.call(this);
      this.fText = AText;
      this.fIndex = AIndex;
      this.fHoverColor.$assign(pas.GameBase.TGameColor.Transparent());
      this.fBackGround.$assign(pas.GameBase.TGameColor.Transparent());
      this.fLabel = $mod.TGUILabel.$create("Create$3");
      this.AddChild(this.fLabel);
      this.fLabel.fHitTestVisible = false;
      this.fLabel.SetSize(this.fHeight,0,10000,this.fHeight);
      this.fLabel.SetCaption(AText);
      return this;
    };
    this.SetSize = function (AX, AY, AWidth, AHeight) {
      pas.guibase.TGUIElement.SetSize.call(this,AX,AY,AWidth,AHeight);
      this.fLabel.SetFontSize(this.fHeight);
      this.fLabel.SetSize(this.fHeight,0,10000,this.fHeight);
    };
  });
  rtl.createClass(this,"TGUIDialogs",this.TGUIPanel,function () {
    this.$init = function () {
      $mod.TGUIPanel.$init.call(this);
      this.fHoverColor = pas.GameBase.TGameColor.$new();
      this.fItemHeight = 0;
      this.fOnClickItem = null;
    };
    this.$final = function () {
      this.fHoverColor = undefined;
      this.fOnClickItem = undefined;
      $mod.TGUIPanel.$final.call(this);
    };
    this.ClickItem = function (ATarget, APosition) {
      var res = null;
      res = ATarget;
      if (this.fOnClickItem !== null) this.fOnClickItem(res.fIndex);
    };
    this.Render = function (AContext, AViewport) {
      $mod.TGUIPanel.Render.call(this,AContext,AViewport);
    };
    this.Create$4 = function () {
      $mod.TGUIPanel.Create$3.call(this);
      return this;
    };
    this.Clear = function () {
      var c = null;
      var i = 0;
      for (var $l = this.GetChildCount() - 1; $l >= 0; $l--) {
        i = $l;
        c = this.GetChild(i);
        this.RemoveChild(c);
        c = rtl.freeLoc(c);
      };
    };
    this.AddItem = function (AIndex, AText) {
      var c = null;
      c = $mod.TGUIDialogOption.$create("Create$4",[AIndex,AText]);
      c.SetSize(0,this.GetChildCount() * this.fItemHeight,this.fWidth,this.fItemHeight);
      c.fOnClick = rtl.createCallback(this,"ClickItem");
      c.fHoverColor.$assign(this.fHoverColor);
      this.AddChild(c);
    };
  });
  $mod.$implcode = function () {
    $impl.GetScreenQuad = function (APosition, AWidth, AHeight) {
      var Result = rtl.arraySetLength(null,pas.GameMath.TPVector,4);
      Result[0].$assign(APosition.Add(pas.GameMath.TPVector.New(0,0,0)));
      Result[1].$assign(APosition.Add(pas.GameMath.TPVector.New(AWidth,0,0)));
      Result[2].$assign(APosition.Add(pas.GameMath.TPVector.New(AWidth,AHeight,0)));
      Result[3].$assign(APosition.Add(pas.GameMath.TPVector.New(0,AHeight,0)));
      return Result;
    };
  };
},["SysUtils"]);
rtl.module("ECS",["System","GameBase","JS","Classes","SysUtils","contnrs"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass(this,"TECEntity",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fKey = "";
      this.fSystem = null;
      this.fComponentData = [];
      this.Components = null;
    };
    this.$final = function () {
      this.fSystem = undefined;
      this.fComponentData = undefined;
      this.Components = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.GetData = function (AComponent) {
      var Result = null;
      Result = this.fComponentData[AComponent];
      return Result;
    };
    this.GetKey = function () {
      var Result = "";
      Result = this.fKey;
      return Result;
    };
    this.Create$1 = function (ASystem) {
      pas.System.TObject.Create.call(this);
      this.fKey = pas.SysUtils.IntToStr($impl.idxCtr);
      $impl.idxCtr += 1;
      this.Components = new Array();
      this.fSystem = ASystem;
      this.fSystem.AddEntity(this);
      return this;
    };
    this.Destroy = function () {
      var comp = undefined;
      for (var $in = this.Components, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        comp = $in[$l];
        rtl.getObject(comp).DeInit(this);
      };
      this.fSystem.RemoveEntity(this);
      pas.System.TObject.Destroy.call(this);
    };
    this.AddComponent = function (AComponent) {
      if (this.Components.indexOf(AComponent) <= -1) {
        this.fComponentData[AComponent.fIndex] = new Map();
        this.Components.push(AComponent);
        AComponent.Init(this);
      };
    };
    this.HasComponent = function (AComponent) {
      var Result = false;
      Result = this.Components.indexOf(AComponent) > -1;
      return Result;
    };
  });
  rtl.createClass(this,"TECComponent",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fIndex = 0;
    };
    this.GetData = function (AEntity) {
      var Result = null;
      Result = AEntity.GetData(this.fIndex);
      return Result;
    };
    this.Init = function (AEntity) {
    };
    this.DeInit = function (AEntity) {
    };
    this.Update = function (AEntity, ADeltaMS, ATimeMS) {
    };
  });
  rtl.createClass(this,"TECSystem",pas.GameBase.TGameElement,function () {
    this.$init = function () {
      pas.GameBase.TGameElement.$init.call(this);
      this.fComponents = null;
      this.fEntities = null;
      this.fFirst = false;
      this.fDelta = 0.0;
      this.fLastTime = 0.0;
    };
    this.$final = function () {
      this.fComponents = undefined;
      this.fEntities = undefined;
      pas.GameBase.TGameElement.$final.call(this);
    };
    this.Update = function (AGame, ATimeMS) {
      var el = undefined;
      var beh = undefined;
      this.fDelta = ATimeMS - this.fLastTime;
      this.fLastTime = ATimeMS;
      if (this.fFirst) this.fDelta = 0;
      this.fFirst = false;
      for (var $in = this.fEntities, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        el = $in[$l];
        for (var $in1 = rtl.getObject(el).Components, $l1 = 0, $end1 = rtl.length($in1) - 1; $l1 <= $end1; $l1++) {
          beh = $in1[$l1];
          rtl.getObject(beh).Update(rtl.getObject(el),this.fDelta,ATimeMS);
        };
      };
      pas.GameBase.TGameElement.Update.call(this,AGame,ATimeMS);
    };
    this.Create$2 = function () {
      pas.GameBase.TGameElement.Create$1.call(this,false);
      this.fFirst = true;
      this.fComponents = pas.contnrs.TObjectList.$create("Create$3",[true]);
      this.fEntities = new Array();
      return this;
    };
    this.Destroy = function () {
      rtl.free(this,"fComponents");
      pas.System.TObject.Destroy.call(this);
    };
    this.RegisterComponent = function (AComponentType) {
      var Result = null;
      Result = AComponentType.$create("Create");
      Result.fIndex = this.fComponents.GetCount();
      this.fComponents.Add$1(Result);
      return Result;
    };
    this.AddEntity = function (AEntity) {
      this.fEntities.push(AEntity);
    };
    this.RemoveEntity = function (AEntity) {
      var idx = 0;
      idx = this.fEntities.indexOf(AEntity);
      if (idx > -1) this.fEntities.splice(idx,1);
    };
  });
  this.EntitySystem = null;
  $mod.$implcode = function () {
    $impl.idxCtr = 0;
  };
  $mod.$init = function () {
    $mod.EntitySystem = $mod.TECSystem.$create("Create$2");
  };
},[]);
rtl.module("ldconfig",["System","JS","Classes","SysUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.recNewT(this,"TConfig",function () {
    this.SectorTiles = 0;
    this.SectorSize = 0;
    this.GrowthTime = 0;
    this.BarleyHarvest = 0;
    this.HopsHarvest = 0;
    this.HealingFactor = 0.0;
    this.BacLowering = 0.0;
    this.PlayerReach = 0.0;
    this.PlayerAnnoyanceLevel = 0.0;
    this.PlayerAttackRange = 0.0;
    this.KingAnnoyanceLevel = 0.0;
    this.DamageRange = 0.0;
    this.DamageAnnoyanceRatio = 0.0;
    this.AnnoyanceCooldown = 0.0;
    this.Characters = null;
    this.$eq = function (b) {
      return (this.SectorTiles === b.SectorTiles) && (this.SectorSize === b.SectorSize) && (this.GrowthTime === b.GrowthTime) && (this.BarleyHarvest === b.BarleyHarvest) && (this.HopsHarvest === b.HopsHarvest) && (this.HealingFactor === b.HealingFactor) && (this.BacLowering === b.BacLowering) && (this.PlayerReach === b.PlayerReach) && (this.PlayerAnnoyanceLevel === b.PlayerAnnoyanceLevel) && (this.PlayerAttackRange === b.PlayerAttackRange) && (this.KingAnnoyanceLevel === b.KingAnnoyanceLevel) && (this.DamageRange === b.DamageRange) && (this.DamageAnnoyanceRatio === b.DamageAnnoyanceRatio) && (this.AnnoyanceCooldown === b.AnnoyanceCooldown) && (this.Characters === b.Characters);
    };
    this.$assign = function (s) {
      this.SectorTiles = s.SectorTiles;
      this.SectorSize = s.SectorSize;
      this.GrowthTime = s.GrowthTime;
      this.BarleyHarvest = s.BarleyHarvest;
      this.HopsHarvest = s.HopsHarvest;
      this.HealingFactor = s.HealingFactor;
      this.BacLowering = s.BacLowering;
      this.PlayerReach = s.PlayerReach;
      this.PlayerAnnoyanceLevel = s.PlayerAnnoyanceLevel;
      this.PlayerAttackRange = s.PlayerAttackRange;
      this.KingAnnoyanceLevel = s.KingAnnoyanceLevel;
      this.DamageRange = s.DamageRange;
      this.DamageAnnoyanceRatio = s.DamageAnnoyanceRatio;
      this.AnnoyanceCooldown = s.AnnoyanceCooldown;
      this.Characters = s.Characters;
      return this;
    };
  });
  this.Config = this.TConfig.$new();
  this.LoadConfig = function (AInfo) {
    var fInfo = null;
    var obj = null;
    var key = "";
    fInfo = JSON.parse(AInfo);
    $mod.Config.SectorTiles = $impl.TryGet(fInfo,"SectorTiles",3);
    $mod.Config.SectorSize = $impl.TryGet(fInfo,"SectorSize",150);
    $mod.Config.GrowthTime = $impl.TryGet(fInfo,"GrowthTime",10);
    $mod.Config.BarleyHarvest = $impl.TryGet(fInfo,"BarleyHarvest",3);
    $mod.Config.HopsHarvest = $impl.TryGet(fInfo,"HopsHarvest",2);
    $mod.Config.HealingFactor = $impl.TryGetDouble(fInfo,"HealingFactor",0.05);
    $mod.Config.BacLowering = $impl.TryGetDouble(fInfo,"BacLowering",0.1);
    $mod.Config.PlayerReach = $impl.TryGetDouble(fInfo,"PlayerReach",30);
    $mod.Config.PlayerAnnoyanceLevel = $impl.TryGetDouble(fInfo,"PlayerAnnoyanceLevel",2);
    $mod.Config.PlayerAttackRange = $impl.TryGetDouble(fInfo,"PlayerAttackRange",100);
    $mod.Config.KingAnnoyanceLevel = $impl.TryGetDouble(fInfo,"KingAnnoyanceLevel",10);
    $mod.Config.DamageRange = $impl.TryGetDouble(fInfo,"DamageRange",40);
    $mod.Config.DamageAnnoyanceRatio = $impl.TryGetDouble(fInfo,"DamageAnnoyanceRatio",1);
    $mod.Config.AnnoyanceCooldown = $impl.TryGetDouble(fInfo,"AnnoyanceCooldown",0.9);
    $mod.Config.Characters = new Map();
    obj = fInfo["Characters"];
    for (var $in = Object.keys(obj), $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
      key = $in[$l];
      $mod.Config.Characters.set(key,obj[key]);
    };
  };
  $mod.$implcode = function () {
    $impl.TryGet = function (AObj, AKey, ADefault) {
      var Result = 0;
      if (AObj.hasOwnProperty(AKey)) {
        Result = rtl.trunc(AObj[AKey])}
       else Result = ADefault;
      return Result;
    };
    $impl.TryGetDouble = function (AObj, AKey, ADefault) {
      var Result = 0.0;
      if (AObj.hasOwnProperty(AKey)) {
        Result = rtl.getNumber(AObj[AKey])}
       else Result = ADefault;
      return Result;
    };
  };
},[]);
rtl.module("ldsounds",["System","JS","Web","Classes","SysUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  this.AddSound = function (name, Snd) {
    if (!$impl.Sounds.has(name)) $impl.Sounds.set(name,new Array());
    $impl.Sounds.get(name).push(Snd);
  };
  this.GetSound = function (name) {
    var Result = null;
    var res = undefined;
    var r = null;
    res = $impl.Sounds.get(name);
    if (res == undefined) {
      Result = null}
     else {
      r = res;
      Result = r[pas.System.Random(r.length)];
    };
    return Result;
  };
  $mod.$implcode = function () {
    $impl.Sounds = null;
  };
  $mod.$init = function () {
    $impl.Sounds = new Map();
  };
},[]);
rtl.module("ldai",["System","ldactor","ldconfig","ECS","GameMath","Classes","SysUtils","JS"],function () {
  "use strict";
  var $mod = this;
  this.TNPCState = {"0": "npcDead", npcDead: 0, "1": "npcAttacking", npcAttacking: 1, "2": "npcAttackMove", npcAttackMove: 2, "3": "npcIdle", npcIdle: 3};
  this.TIdlingState = {"0": "isRumaging", isRumaging: 0};
  rtl.createClass(this,"TNPCBehavior",pas.ECS.TECComponent,function () {
    this.DoAttack = function (AEntity, ATarget) {
      var diff = pas.GameMath.TPVector.$new();
      var data = null;
      var dist = 0.0;
      data = this.GetData(AEntity);
      diff.$assign(ATarget.fCharacter.fPosition.Sub(AEntity.fCharacter.fPosition));
      dist = diff.LengthSqr();
      if (dist < 100) {
        AEntity.fCharacter.TriggerAttack()}
       else AEntity.fCharacter.fTarget.$assign(ATarget.fCharacter.fPosition);
    };
    this.Distance = function (AEntity, ATarget) {
      var Result = 0.0;
      Result = ATarget.fCharacter.fPosition.Sub(AEntity.fCharacter.fPosition).Length();
      return Result;
    };
    this.Annoyance = function (AEntity, ATarget) {
      var Result = 0.0;
      var ann = null;
      Result = 0;
      ann = this.GetData(AEntity).get("annoyances");
      if (ann.has(ATarget.GetKey())) Result = rtl.getNumber(ann.get(ATarget.GetKey()));
      return Result;
    };
    this.WantsToAttack = function (AEntity, ATarget) {
      var Result = false;
      Result = false;
      if (AEntity === ATarget) return false;
      if (AEntity.fCharacter.fSector !== ATarget.fCharacter.fSector) return false;
      if (!ATarget.fCharacter.GetAlive()) return false;
      if (ATarget.fCharacter === pas.ldactor.Player) {
        Result = (this.Annoyance(AEntity,ATarget) >= pas.ldconfig.Config.PlayerAnnoyanceLevel) && (this.Distance(AEntity,ATarget) < pas.ldconfig.Config.PlayerAttackRange)}
       else if (ATarget.fCharacter === pas.ldactor.King) Result = this.Annoyance(AEntity,ATarget) >= pas.ldconfig.Config.KingAnnoyanceLevel;
      return Result;
    };
    this.Init = function (AEntity) {
      var data = null;
      pas.ECS.TECComponent.Init.call(this,AEntity);
      data = this.GetData(AEntity);
      data.set("state",3);
      data.set("annoyances",new Map());
    };
    this.Update = function (AEntity, ADeltaMS, ATimeMS) {
      var data = null;
      var annoyances = null;
      var k = "";
      var coolDown = 0.0;
      pas.ECS.TECComponent.Update.call(this,AEntity,ADeltaMS,ATimeMS);
      data = this.GetData(AEntity);
      coolDown = pas.ldconfig.Config.AnnoyanceCooldown;
      annoyances = data.get("annoyances");
      for (k in annoyances.keys()) annoyances.set(k,rtl.getNumber(annoyances.get(k)) * coolDown * ADeltaMS);
      if (!AEntity.fCharacter.GetAlive()) {
        data.set("state",0)}
       else if (this.WantsToAttack(AEntity,pas.ldactor.Player.fActor)) {
        data.set("state",1);
        data.set("target",pas.ldactor.Player);
        this.DoAttack(AEntity,pas.ldactor.Player.fActor);
      } else if (this.WantsToAttack(AEntity,pas.ldactor.King.fActor)) {
        data.set("state",1);
        data.set("target",pas.ldactor.King);
        this.DoAttack(AEntity,pas.ldactor.King.fActor);
      } else data.set("state",3);
    };
    this.AddAnnoyance = function (AEntity, ATarget, AAnnoyance) {
      var data = null;
      var annoyances = null;
      var k = "";
      data = this.GetData(AEntity);
      annoyances = data.get("annoyances");
      k = ATarget.GetKey();
      if (annoyances.has(k)) {
        annoyances.set(k,rtl.getNumber(annoyances.get(k)) + AAnnoyance)}
       else annoyances.set(k,AAnnoyance);
    };
  });
  rtl.createClass(this,"THomeTileBehavior",this.TNPCBehavior,function () {
    this.UpdateInterval = 5;
    this.Init = function (AEntity) {
      var ent = null;
      $mod.TNPCBehavior.Init.call(this,AEntity);
      ent = this.GetData(AEntity);
      ent.set("home-state",0);
      ent.set("home-sector",0);
      ent.set("home-x",0);
      ent.set("home-y",0);
      ent.set("last-update",-100000.0);
    };
    this.Update = function (AEntity, ADeltaMS, ATimeMS) {
      var ent = null;
      var last_update = 0.0;
      var x = 0.0;
      var y = 0.0;
      var char = null;
      var newCoord = pas.GameMath.TPVector.$new();
      var state = 0;
      var npcState = 0;
      ent = this.GetData(AEntity);
      char = AEntity.fCharacter;
      $mod.TNPCBehavior.Update.call(this,AEntity,ADeltaMS,ATimeMS);
      npcState = ent.get("state");
      if (npcState === 3) {
        state = ent.get("home-state");
        var $tmp = state;
        if ($tmp === 0) {
          last_update = rtl.getNumber(ent.get("last-update"));
          if ((ATimeMS - last_update) > (5 * 1000)) {
            x = rtl.getNumber(ent.get("home-x"));
            y = rtl.getNumber(ent.get("home-y"));
            newCoord.$assign(pas.GameMath.TPVector.New(((x + Math.random()) * pas.ldconfig.Config.SectorSize * 0.99) + 0.01,((y + Math.random()) * pas.ldconfig.Config.SectorSize * 0.99) + 0.01,0));
            char.fTarget.$assign(newCoord);
            if (char.fVisible && $mod.TFarmerBehavior.isPrototypeOf(this)) pas.GameBase.Game().fAudio.Play(pas.ldsounds.GetSound("rake"),0.3,false);
            ent.set("last-update",ATimeMS - (1000 * Math.random()));
          };
        };
      };
    };
    this.SetHomeTile = function (AEntity, ASector, AX, AY) {
      var ent = null;
      ent = this.GetData(AEntity);
      ent.set("home-sector",ASector);
      ent.set("home-x",AX);
      ent.set("home-y",AY);
    };
  });
  rtl.createClass(this,"TFarmerBehavior",this.THomeTileBehavior,function () {
  });
  rtl.createClass(this,"TPlayerBehavior",pas.ECS.TECComponent,function () {
  });
  rtl.createClass(this,"TGuardBehavior",this.THomeTileBehavior,function () {
  });
  rtl.createClass(this,"TKingBehavior",this.THomeTileBehavior,function () {
  });
  this.FarmerBehavior = null;
  this.GuardBehavior = null;
  this.KingBehavior = null;
  this.PlayerBehavior = null;
  $mod.$init = function () {
    $mod.FarmerBehavior = pas.ldactor.RegisterComponent("farmer",$mod.THomeTileBehavior);
    $mod.GuardBehavior = pas.ldactor.RegisterComponent("guard",$mod.TGuardBehavior);
    $mod.KingBehavior = pas.ldactor.RegisterComponent("king",$mod.TKingBehavior);
    $mod.PlayerBehavior = pas.ldactor.RegisterComponent("player",$mod.TPlayerBehavior);
  };
},["GameBase","ldsounds"]);
rtl.module("ldactor",["System","GameBase","GameSprite","GameMath","ECS","JS","Web","webgl","Classes","SysUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass(this,"TLDActor",pas.ECS.TECEntity,function () {
    this.$init = function () {
      pas.ECS.TECEntity.$init.call(this);
      this.fCharacter = null;
    };
    this.$final = function () {
      this.fCharacter = undefined;
      pas.ECS.TECEntity.$final.call(this);
    };
    this.Create$2 = function (ASystem, ACharacter) {
      pas.ECS.TECEntity.Create$1.call(this,ASystem);
      this.fCharacter = ACharacter;
      return this;
    };
  });
  rtl.createClass(this,"TLDCharacter",pas.GameBase.TGameElement,function () {
    this.$init = function () {
      pas.GameBase.TGameElement.$init.call(this);
      this.fAttacking = false;
      this.fAttackSound = null;
      this.fBac = 0.0;
      this.fBaseDamage = 0.0;
      this.fBaseHP = 0.0;
      this.fGold = 0;
      this.fHP = 0.0;
      this.fNau = 0.0;
      this.fTarget = pas.GameMath.TPVector.$new();
      this.fName = "";
      this.fActor = null;
      this.fAnimation = "";
      this.fSpeed = 0.0;
      this.fSprite = null;
      this.fSector = 0;
      this.fTime = 0.0;
      this.fAttackTime = 0.0;
      this.fLastTime = 0.0;
    };
    this.$final = function () {
      this.fAttackSound = undefined;
      this.fTarget = undefined;
      this.fActor = undefined;
      this.fSprite = undefined;
      pas.GameBase.TGameElement.$final.call(this);
    };
    this.GetAlive = function () {
      var Result = false;
      Result = this.fHP > 0;
      return Result;
    };
    this.GetDamage = function () {
      var Result = 0.0;
      Result = this.fBaseDamage * (1 + (this.fBac / 6));
      return Result;
    };
    this.GetMaxHP = function () {
      var Result = 0.0;
      Result = this.fBaseHP * (1 + (this.fBac / 6));
      return Result;
    };
    this.GetSpeed = function () {
      var Result = 0.0;
      Result = this.fSpeed * (1 + (this.fBac / 6));
      return Result;
    };
    this.Render = function (GL, AViewport) {
      var frame = pas.GameSprite.TGameFrame.$new();
      if (this.fAttacking) {
        frame.$assign(this.fSprite.GetFrame(this.fAnimation,this.fTime - this.fAttackTime,true))}
       else frame.$assign(this.fSprite.GetFrame(this.fAnimation,this.fTime,true));
      pas.GameSprite.RenderFrame(GL,AViewport,$impl.GetCharRect(pas.GameMath.TPVector.$clone(this.fPosition),40,40,0,1),frame);
      pas.GameSprite.RenderQuad(GL,AViewport,$impl.GetCharRect(pas.GameMath.TPVector.$clone(this.fPosition),40,43,42,this.fHP / this.GetMaxHP()),pas.GameBase.TGameColor.New(1,0,0,1.0));
      pas.GameSprite.RenderQuad(GL,AViewport,$impl.GetCharRect(pas.GameMath.TPVector.$clone(this.fPosition),40,42,41,this.fBac / 6),pas.GameBase.TGameColor.New(0,1,0,1.0));
      pas.GameSprite.RenderQuad(GL,AViewport,$impl.GetCharRect(pas.GameMath.TPVector.$clone(this.fPosition),40,41,40,this.fNau / 1),pas.GameBase.TGameColor.New(0,0,1,1.0));
    };
    this.Update = function (AGame, ATimeMS) {
      var $Self = this;
      var fMoveDiff = pas.GameMath.TPVector.$new();
      var fMoveLen = 0.0;
      var fMaxMove = 0.0;
      var delta = 0.0;
      function TestTravel(AX, AY, ACorrection) {
        var sec = null;
        if (pas.ldmap.Map.HasSector(pas.ldmap.Map.fCurrentSector.fX + AX,pas.ldmap.Map.fCurrentSector.fY + AY)) {
          sec = pas.ldmap.Map.GetSector(pas.ldmap.Map.fCurrentSector.fX + AX,pas.ldmap.Map.fCurrentSector.fY + AY);
          $Self.fSector = sec.fID;
          pas.ldmap.Map.SetCurrentSector(sec);
          $Self.fPosition.$assign($Self.fPosition.Add(ACorrection));
        };
      };
      pas.GameBase.TGameElement.Update.call(this,AGame,ATimeMS);
      delta = (ATimeMS / 1000) - this.fTime;
      if (this.GetAlive()) {
        if (this.fHP < this.GetMaxHP()) this.fHP = this.fHP + (delta * pas.ldconfig.Config.HealingFactor * this.GetMaxHP());
        if (this.fHP > this.GetMaxHP()) this.fHP = this.GetMaxHP();
        this.fBac = this.fBac - (delta * pas.ldconfig.Config.BacLowering);
        if (this.fBac < 0) this.fBac = 0;
      };
      this.fTime = ATimeMS / 1000;
      if (this.fAttacking) if ((this.fTime - this.fAttackTime) >= this.fSprite.GetAnimation(this.fAnimation).fLooptime) {
        this.fAttacking = false;
        this.fAnimation = "idle";
        $mod.DamageAt($Self,this.fSector,pas.GameMath.TPVector.$clone(this.fPosition),this.GetDamage(),false);
      };
      if (!this.fAttacking) {
        fMoveDiff.$assign(this.fTarget.Sub(this.fPosition));
        fMoveLen = fMoveDiff.LengthSqr();
        fMaxMove = (this.fTime - this.fLastTime) * this.GetSpeed();
        if (pas.System.Sqr$1(fMaxMove) >= fMoveLen) {
          this.fPosition.$assign(this.fTarget);
          this.fAnimation = "idle";
        } else if (fMoveLen > 0) {
          this.fAnimation = "walk";
          this.fPosition.$assign(this.fPosition.Add(fMoveDiff.Scale(fMaxMove / Math.sqrt(fMoveLen))));
        };
        if ($Self === $mod.Player) {
          if (this.fPosition.X >= $mod.SectorMax) {
            TestTravel(1,0,pas.GameMath.TPVector.$clone(pas.GameMath.TPVector.New(-$mod.SectorMax,0,0)))}
           else if (this.fPosition.X < 0) TestTravel(-1,0,pas.GameMath.TPVector.$clone(pas.GameMath.TPVector.New($mod.SectorMax,0,0)));
          if (this.fPosition.Y >= $mod.SectorMax) {
            TestTravel(0,1,pas.GameMath.TPVector.$clone(pas.GameMath.TPVector.New(0,-$mod.SectorMax,0)))}
           else if (this.fPosition.Y < 0) TestTravel(0,-1,pas.GameMath.TPVector.$clone(pas.GameMath.TPVector.New(0,$mod.SectorMax,0)));
        };
        this.fPosition.$assign(this.fPosition.Clamp(pas.GameMath.TPVector.New(0,0,0),pas.GameMath.TPVector.New($mod.SectorMax,$mod.SectorMax,0)));
      };
      this.fLastTime = this.fTime;
    };
    this.Create$2 = function (AName, ASprite, ASector, AX, AY) {
      pas.GameBase.TGameElement.Create$1.call(this,false);
      this.fAttacking = false;
      this.fAnimation = "idle";
      this.fName = AName;
      this.fActor = $mod.TLDActor.$create("Create$2",[pas.ECS.EntitySystem,this]);
      this.fSprite = ASprite;
      this.fSector = ASector;
      this.fPosition.$assign(pas.GameMath.TPVector.New(AX,AY,0));
      return this;
    };
    this.DrinkBeer = function (AStrength) {
      this.fBac = this.fBac + AStrength;
    };
    this.DealDamage = function (ADamage) {
      this.fHP = this.fHP - ADamage;
      if (this.fHP < 0) this.fHP = 0;
    };
    this.TriggerAttack = function () {
      var Result = false;
      if (this.fAttacking) return false;
      if ((this.fAttackSound !== null) && this.fVisible) pas.GameBase.Game().fAudio.Play(this.fAttackSound,1,false);
      this.fAttackTime = this.fTime;
      this.fAttacking = true;
      this.fAnimation = "attack";
      Result = true;
      return Result;
    };
  });
  this.MaxBAC = 6;
  this.MaxNau = 1;
  this.SectorMax = 0.0;
  this.Player = null;
  this.King = null;
  this.CharactersVisible = null;
  this.Characters = null;
  this.Behaviors = null;
  this.GetName = function () {
    var Result = "";
    Result = "Bob";
    return Result;
  };
  this.DamageAt = function (AGiver, ASector, APosition, ADamage, AOnlyAnnoy) {
    var sqrDist = 0.0;
    var ch = null;
    var o = undefined;
    var oo = null;
    sqrDist = pas.System.Sqr$1(pas.ldconfig.Config.DamageRange);
    ch = $mod.Characters.filter(function (el, idx, arr) {
      var Result = false;
      Result = (rtl.getObject(el) !== AGiver) && (rtl.getObject(el).fSector === ASector) && (rtl.getObject(el).fPosition.Sub(AGiver.fPosition).LengthSqr() < sqrDist);
      return Result;
    });
    for (var $in = ch, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
      o = $in[$l];
      if (!AOnlyAnnoy) rtl.getObject(o).DealDamage(ADamage);
      oo = rtl.getObject(o);
      if (oo !== $mod.Player) {
        if (oo.fActor.HasComponent(pas.ldai.KingBehavior)) pas.ldai.KingBehavior.AddAnnoyance(oo.fActor,AGiver.fActor,ADamage * pas.ldconfig.Config.DamageAnnoyanceRatio);
        if (oo.fActor.HasComponent(pas.ldai.GuardBehavior)) pas.ldai.GuardBehavior.AddAnnoyance(oo.fActor,AGiver.fActor,ADamage * pas.ldconfig.Config.DamageAnnoyanceRatio);
        if (oo.fActor.HasComponent(pas.ldai.FarmerBehavior)) pas.ldai.FarmerBehavior.AddAnnoyance(oo.fActor,AGiver.fActor,ADamage * pas.ldconfig.Config.DamageAnnoyanceRatio);
      };
    };
  };
  this.SpawnCharacter = function (AName, AType, ASector, AX, AY) {
    var Result = null;
    $mod.SectorMax = pas.ldconfig.Config.SectorSize * pas.ldconfig.Config.SectorTiles;
    Result = $mod.TLDCharacter.$create("Create$2",[AType,$impl.GetCharacterSprite(AType),ASector,AX,AY]);
    $mod.Characters.push(Result);
    $impl.ConfigureCharacter(Result,AType);
    pas.GameBase.Game().AddElement(Result);
    return Result;
  };
  this.RegisterComponent = function (AName, AType) {
    var Result = null;
    if ($mod.Behaviors === null) $mod.Behaviors = new Map();
    Result = pas.ECS.EntitySystem.RegisterComponent(AType);
    $mod.Behaviors.set(AName,Result);
    return Result;
  };
  this.ShowCharacters = function (ASector) {
    var ch = undefined;
    $mod.CharactersVisible = new Array();
    for (var $in = $mod.Characters, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
      ch = $in[$l];
      rtl.getObject(ch).fVisible = rtl.getObject(ch).fSector === ASector;
      if (rtl.getObject(ch).fSector === ASector) $mod.CharactersVisible.push(rtl.getObject(ch));
    };
  };
  $mod.$implcode = function () {
    $impl.ConfigureCharacter = function (AChar, AType) {
      var cfg = null;
      var beh = undefined;
      cfg = pas.ldconfig.Config.Characters.get(AType);
      AChar.fHP = rtl.getNumber(cfg["hp"]);
      AChar.fBaseHP = rtl.getNumber(cfg["hp"]);
      AChar.fSpeed = rtl.getNumber(cfg["speed"]);
      AChar.fBaseDamage = rtl.getNumber(cfg["damage"]);
      AChar.fAttackSound = pas.ldsounds.GetSound("" + cfg["attacksound"]);
      AChar.fTarget.$assign(AChar.fPosition);
      for (var $in = cfg["behavior"], $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        beh = $in[$l];
        AChar.fActor.AddComponent(rtl.getObject($mod.Behaviors.get(beh)));
      };
    };
    $impl.GetCharacterSprite = function (AType) {
      var Result = null;
      var spriteName = "";
      spriteName = "" + pas.ldconfig.Config.Characters.get(AType)["sprite"];
      Result = pas.GameSprite.GetSprite(spriteName);
      return Result;
    };
    $impl.GetCharRect = function (ACenter, AWidth, AHeight, YOffset, XScale) {
      var Result = rtl.arraySetLength(null,pas.GameMath.TPVector,4);
      Result[0].$assign(ACenter.Add(pas.GameMath.TPVector.New(-AWidth / 2,0,AHeight)));
      Result[1].$assign(ACenter.Add(pas.GameMath.TPVector.New((-AWidth / 2) + (AWidth * XScale),0,AHeight)));
      Result[2].$assign(ACenter.Add(pas.GameMath.TPVector.New((-AWidth / 2) + (AWidth * XScale),0,YOffset)));
      Result[3].$assign(ACenter.Add(pas.GameMath.TPVector.New(-AWidth / 2,0,YOffset)));
      return Result;
    };
  };
  $mod.$init = function () {
    $mod.Characters = new Array();
  };
},["ldai","ldmap","ldsounds","ldconfig"]);
rtl.module("ldmap",["System","JS","webgl","ECS","resources","ldconfig","GameBase","GameSprite","GameMath","Classes","SysUtils"],function () {
  "use strict";
  var $mod = this;
  var $impl = $mod.$impl;
  rtl.createClass(this,"TLDSectorButton",pas.GameBase.TGameElement,function () {
    this.$init = function () {
      pas.GameBase.TGameElement.$init.call(this);
      this.fAvail = false;
      this.fQuad = rtl.arraySetLength(null,pas.GameMath.TPVector,4);
      this.fSprite = null;
      this.fDirection = 0;
    };
    this.$final = function () {
      this.fQuad = undefined;
      this.fSprite = undefined;
      pas.GameBase.TGameElement.$final.call(this);
    };
    this.Render = function (GL, AViewport) {
      var fAnim = "";
      pas.GameBase.TGameElement.Render.call(this,GL,AViewport);
      fAnim = "idle";
      if (!this.fAvail) fAnim = "locked";
      pas.GameSprite.RenderFrame(GL,AViewport,this.fQuad,this.fSprite.GetFrame(fAnim,0,true));
    };
    this.Create$2 = function (ADirection) {
      var tx = null;
      var t2 = null;
      pas.GameBase.TGameElement.Create$1.call(this,true);
      this.fAvail = true;
      this.fDirection = ADirection;
      this.fSprite = pas.GameSprite.GetSprite("sector_button");
      this.fQuad = $impl.MakeSecButtonQuad(2 * pas.ldconfig.Config.SectorSize,(2 / 4) * pas.ldconfig.Config.SectorSize);
      tx = pas.GameMath.TPMatrix.$create("CreateTranslation",[-1.5 * pas.ldconfig.Config.SectorSize,-1.5 * pas.ldconfig.Config.SectorSize,0]).Transpose();
      tx.TransformInplace({p: this, get: function () {
          return this.p.fQuad;
        }, set: function (v) {
          this.p.fQuad = v;
        }});
      t2 = pas.GameMath.TPMatrix.$create("CreateRotationZ",[(-ADirection * Math.PI) / 2]).Transpose();
      t2.TransformInplace({p: this, get: function () {
          return this.p.fQuad;
        }, set: function (v) {
          this.p.fQuad = v;
        }});
      tx.GetInverse().TransformInplace({p: this, get: function () {
          return this.p.fQuad;
        }, set: function (v) {
          this.p.fQuad = v;
        }});
      return this;
    };
  });
  rtl.createClass(this,"TLDMapTileInfo",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fAnimation = "";
      this.fBillboards = null;
      this.fSprite = null;
      this.fBehaviors = null;
    };
    this.$final = function () {
      this.fBillboards = undefined;
      this.fSprite = undefined;
      this.fBehaviors = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Create$1 = function (AInfo) {
      pas.System.TObject.Create.call(this);
      this.fBehaviors = AInfo["behavior"];
      this.fSprite = pas.GameSprite.GetSprite("" + AInfo["sprite"]);
      this.fAnimation = "" + AInfo["animation"];
      this.fBillboards = AInfo["billboards"];
      if (this.fBillboards == undefined) this.fBillboards = new Array();
      return this;
    };
  });
  rtl.createClass(this,"TLDMapTiles",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fMap = null;
    };
    this.$final = function () {
      this.fMap = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.GetTile = function (AName) {
      var Result = null;
      Result = rtl.getObject(this.fMap.get(AName));
      return Result;
    };
    this.Create$1 = function (AInformation) {
      var fInfo = null;
      var el = "";
      fInfo = JSON.parse(AInformation);
      this.fMap = new Map();
      for (var $in = Object.keys(fInfo["tiles"]), $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        el = $in[$l];
        this.fMap.set(el,$mod.TLDMapTileInfo.$create("Create$1",[fInfo["tiles"][el]]));
      };
      return this;
    };
  });
  rtl.createClass(this,"TLDSectorTile",pas.ECS.TECEntity,function () {
    this.$init = function () {
      pas.ECS.TECEntity.$init.call(this);
      this.fTileType = null;
      this.fTime = 0.0;
    };
    this.$final = function () {
      this.fTileType = undefined;
      pas.ECS.TECEntity.$final.call(this);
    };
    this.Update = function (ATimeMS) {
      this.fTime = ATimeMS;
    };
    this.Create$2 = function (ASystem, ATileType, ASector, AX, AY) {
      var beh = undefined;
      pas.ECS.TECEntity.Create$1.call(this,ASystem);
      this.fTileType = ATileType;
      this.AddComponent($mod.TileComp);
      $mod.TileComp.SetInfo(this,ASector,AX,AY);
      for (var $in = ATileType.fBehaviors, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        beh = $in[$l];
        this.AddComponent(rtl.getObject($impl.Behaviors.get(beh)));
      };
      return this;
    };
  });
  rtl.createClass(this,"TLDSector",pas.System.TObject,function () {
    this.$init = function () {
      pas.System.TObject.$init.call(this);
      this.fID = 0;
      this.fTiles = [];
      this.fX = 0;
      this.fY = 0;
    };
    this.$final = function () {
      this.fTiles = undefined;
      pas.System.TObject.$final.call(this);
    };
    this.Update = function (ATimeMS) {
      var i = 0;
      var i2 = 0;
      var sectorTiles = 0;
      sectorTiles = rtl.length(this.fTiles);
      for (var $l = 0, $end = sectorTiles - 1; $l <= $end; $l++) {
        i = $l;
        for (var $l1 = 0, $end1 = sectorTiles - 1; $l1 <= $end1; $l1++) {
          i2 = $l1;
          this.fTiles[i][i2].Update(ATimeMS);
        };
      };
    };
    this.Create$1 = function (AX, AY) {
      var i = 0;
      var i2 = 0;
      var sectorTiles = 0;
      pas.System.TObject.Create.call(this);
      this.fX = AX;
      this.fY = AY;
      this.fID = $impl.Sectors;
      $impl.Sectors += 1;
      sectorTiles = pas.ldconfig.Config.SectorTiles;
      this.fTiles = rtl.arraySetLength(this.fTiles,null,sectorTiles,sectorTiles);
      for (var $l = 0, $end = sectorTiles - 1; $l <= $end; $l++) {
        i = $l;
        for (var $l1 = 0, $end1 = sectorTiles - 1; $l1 <= $end1; $l1++) {
          i2 = $l1;
          this.fTiles[i][i2] = $mod.TLDSectorTile.$create("Create$2",[pas.ECS.EntitySystem,$impl.TileInfo.GetTile("grass"),this.fID,i,i2]);
        };
      };
      return this;
    };
    this.SetTile = function (AX, AY, ATileType) {
      var bb = undefined;
      var width = 0.0;
      var height = 0.0;
      var animation = "";
      var sp = "";
      rtl.free(this.fTiles[AX],AY);
      this.fTiles[AX][AY] = $mod.TLDSectorTile.$create("Create$2",[pas.ECS.EntitySystem,ATileType,this.fID,AX,AY]);
      for (var $in = ATileType.fBillboards, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        bb = $in[$l];
        sp = "" + bb["sprite"];
        animation = "" + bb["animation"];
        width = rtl.getNumber(bb["width"]);
        height = rtl.getNumber(bb["height"]);
        $mod.TileComp.AddBillboard(this.fTiles[AX][AY],pas.GameSprite.GetSprite(sp),animation,width,height);
      };
    };
    this.SetTile$1 = function (AX, AY, AName) {
      this.SetTile(AX,AY,$impl.TileInfo.GetTile(AName));
    };
    this.GetTileAt = function (APos) {
      var Result = null;
      var tileX = 0;
      var tiley = 0;
      tileX = pas.System.Trunc(APos.X / pas.ldconfig.Config.SectorSize);
      tiley = pas.System.Trunc(APos.Y / pas.ldconfig.Config.SectorSize);
      if (tileX < 0) tileX = 0;
      if (tiley < 0) tiley = 0;
      if (tileX >= pas.ldconfig.Config.SectorTiles) tileX = pas.ldconfig.Config.SectorTiles - 1;
      if (tiley >= pas.ldconfig.Config.SectorTiles) tiley = pas.ldconfig.Config.SectorTiles - 1;
      Result = this.fTiles[tileX][tiley];
      return Result;
    };
  });
  rtl.createClass(this,"TLDMap",pas.GameBase.TGameElement,function () {
    this.$init = function () {
      pas.GameBase.TGameElement.$init.call(this);
      this.fCurrentSector = null;
      this.fSectors = null;
    };
    this.$final = function () {
      this.fCurrentSector = undefined;
      this.fSectors = undefined;
      pas.GameBase.TGameElement.$final.call(this);
    };
    this.Update = function (AGame, ATimeMS) {
      var $Self = this;
      pas.GameBase.TGameElement.Update.call(this,AGame,ATimeMS);
      this.fSectors.forEach(function (value, key) {
        rtl.getObject(value).Update(ATimeMS);
      });
    };
    this.Render = function (GL, AViewport) {
      var i = 0;
      var i2 = 0;
      var tile = null;
      pas.GameBase.TGameElement.Render.call(this,GL,AViewport);
      if (this.fCurrentSector === null) return;
      for (var $l = 0, $end = pas.ldconfig.Config.SectorTiles - 1; $l <= $end; $l++) {
        i = $l;
        for (var $l1 = 0, $end1 = pas.ldconfig.Config.SectorTiles - 1; $l1 <= $end1; $l1++) {
          i2 = $l1;
          tile = this.fCurrentSector.fTiles[i][i2];
          pas.GameSprite.RenderFrame(GL,AViewport,$impl.MakeTileQuad(i,i2),tile.fTileType.fSprite.GetFrame(tile.fTileType.fAnimation,tile.fTime,true));
        };
      };
    };
    this.Create$2 = function () {
      pas.GameBase.TGameElement.Create$1.call(this,true);
      this.fSectors = new Map();
      return this;
    };
    this.GetSector = function (AX, AY) {
      var Result = null;
      var key = "";
      key = pas.SysUtils.IntToStr(AX) + "x" + pas.SysUtils.IntToStr(AY);
      if (!this.fSectors.has(key)) this.fSectors.set(key,$mod.TLDSector.$create("Create$1",[AX,AY]));
      Result = rtl.getObject(this.fSectors.get(key));
      return Result;
    };
    this.HasSector = function (AX, AY) {
      var Result = false;
      var key = "";
      key = pas.SysUtils.IntToStr(AX) + "x" + pas.SysUtils.IntToStr(AY);
      Result = this.fSectors.has(key);
      return Result;
    };
    this.SetCurrentSector = function (ASector) {
      var i = 0;
      var i2 = 0;
      var tile = null;
      var hops = null;
      var field = null;
      var sectorTiles = 0;
      hops = rtl.getObject($impl.Behaviors.get("hops"));
      field = rtl.getObject($impl.Behaviors.get("field"));
      if (this.fCurrentSector !== null) {
        sectorTiles = rtl.length(this.fCurrentSector.fTiles);
        for (var $l = 0, $end = sectorTiles - 1; $l <= $end; $l++) {
          i = $l;
          for (var $l1 = 0, $end1 = sectorTiles - 1; $l1 <= $end1; $l1++) {
            i2 = $l1;
            tile = this.fCurrentSector.fTiles[i][i2];
            if (tile.HasComponent(hops)) hops.SetPlantsVisible(tile,false);
            if (tile.HasComponent(field)) field.SetPlantsVisible(tile,false);
            $mod.TileComp.SetBillboardsVisible(tile,false);
          };
        };
      };
      this.fCurrentSector = ASector;
      sectorTiles = rtl.length(this.fCurrentSector.fTiles);
      for (var $l2 = 0, $end2 = sectorTiles - 1; $l2 <= $end2; $l2++) {
        i = $l2;
        for (var $l3 = 0, $end3 = sectorTiles - 1; $l3 <= $end3; $l3++) {
          i2 = $l3;
          tile = this.fCurrentSector.fTiles[i][i2];
          if (tile.HasComponent(hops)) hops.SetPlantsVisible(tile,true);
          if (tile.HasComponent(field)) field.SetPlantsVisible(tile,true);
          $mod.TileComp.SetBillboardsVisible(tile,true);
        };
      };
      pas.ldactor.ShowCharacters(this.fCurrentSector.fID);
      $mod.UpdateNeighbourSectors();
    };
  });
  rtl.createClass(this,"TPlant",pas.GameBase.TGameElement,function () {
    this.$init = function () {
      pas.GameBase.TGameElement.$init.call(this);
      this.fMax = 0;
      this.fSize = 0;
      this.fLastTime = 0.0;
      this.fTime = 0.0;
      this.fTimeOffset = 0.0;
      this.fSprite = null;
    };
    this.$final = function () {
      this.fSprite = undefined;
      pas.GameBase.TGameElement.$final.call(this);
    };
    this.GetName = function () {
      var Result = "";
      Result = this.fSprite.fName;
      return Result;
    };
    this.GetReady = function () {
      var Result = false;
      Result = this.fSize >= this.fMax;
      return Result;
    };
    this.Render = function (GL, AViewport) {
      var frame = pas.GameSprite.TGameFrame.$new();
      frame.$assign(this.fSprite.GetFrame("stage" + pas.SysUtils.IntToStr(this.fSize),this.fTime + this.fTimeOffset,true));
      pas.GameSprite.RenderFrame(GL,AViewport,$impl.GetGrowthRect(pas.GameMath.TPVector.$clone(this.fPosition),40,40),frame);
    };
    this.Update = function (AGame, ATimeMS) {
      if (this.fSize < this.fMax) {
        if ((ATimeMS - this.fLastTime) > (1000 * pas.ldconfig.Config.GrowthTime)) {
          this.fLastTime = ATimeMS;
          this.fSize += 1;
        };
      } else this.fLastTime = ATimeMS;
      this.fTime = ATimeMS / 1000;
    };
    this.Harvest = function () {
      this.fTime = this.fLastTime;
      this.fSize = 0;
    };
    this.Create$2 = function (AX, AY, ASprite, AMaxStage) {
      pas.GameBase.TGameElement.Create$1.call(this,false);
      this.fMax = AMaxStage;
      this.fTimeOffset = Math.random();
      this.fSize = this.fMax;
      this.fPosition.$assign(pas.GameMath.TPVector.New(AX,AY,0));
      this.fSprite = ASprite;
      return this;
    };
  });
  rtl.createClass(this,"TBillboard",pas.GameBase.TGameElement,function () {
    this.$init = function () {
      pas.GameBase.TGameElement.$init.call(this);
      this.fIsItem = false;
      this.fTile = null;
      this.fTime = 0.0;
      this.fTimeOffset = 0.0;
      this.fSprite = null;
      this.fAnimation = "";
      this.fWidth = 0.0;
      this.fHeight = 0.0;
    };
    this.$final = function () {
      this.fTile = undefined;
      this.fSprite = undefined;
      pas.GameBase.TGameElement.$final.call(this);
    };
    this.Render = function (GL, AViewport) {
      var frame = pas.GameSprite.TGameFrame.$new();
      frame.$assign(this.fSprite.GetFrame(this.fAnimation,this.fTime + this.fTimeOffset,true));
      pas.GameSprite.RenderFrame(GL,AViewport,$impl.GetGrowthRect(pas.GameMath.TPVector.$clone(this.fPosition),this.fWidth,this.fHeight),frame);
    };
    this.Update = function (AGame, ATimeMS) {
      this.fTime = ATimeMS / 1000;
    };
    this.Create$2 = function (ATile, AX, AY, AWidth, AHeight, ASprite, AAnimation) {
      pas.GameBase.TGameElement.Create$1.call(this,false);
      this.fTile = ATile;
      this.fTimeOffset = Math.random();
      this.fPosition.$assign(pas.GameMath.TPVector.New(AX,AY,0));
      this.fSprite = ASprite;
      this.fAnimation = AAnimation;
      this.fWidth = AWidth;
      this.fHeight = AHeight;
      return this;
    };
  });
  rtl.createClass(this,"TTileComponent",pas.ECS.TECComponent,function () {
    this.Init = function (AEntity) {
      pas.ECS.TECComponent.Init.call(this,AEntity);
      this.GetData(AEntity).set("billboards",new Array());
    };
    this.DeInit = function (AEntity) {
      var bbs = null;
      var o = undefined;
      bbs = this.GetData(AEntity).get("billboards");
      for (var $in = bbs, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        o = $in[$l];
        pas.GameBase.Game().RemoveElement(rtl.getObject(o),true);
      };
    };
    this.SetInfo = function (ATile, ASector, AX, AY) {
      var data = null;
      data = this.GetData(ATile);
      data.set("sector",ASector);
      data.set("x",AX);
      data.set("y",AY);
    };
    this.GetInfo = function (ATile, ASector, AX, AY) {
      var data = null;
      data = this.GetData(ATile);
      ASector.set(rtl.trunc(data.get("sector")));
      AX.set(rtl.trunc(data.get("x")));
      AY.set(rtl.trunc(data.get("y")));
    };
    this.AddBillboard = function (ATile, ASprite, AAnimation, AWidth, AHeight) {
      var Result = null;
      var bbs = null;
      var s = 0;
      var x = 0;
      var y = 0;
      var SectorSize = 0;
      var bb = null;
      bbs = this.GetData(ATile).get("billboards");
      this.GetInfo(ATile,{get: function () {
          return s;
        }, set: function (v) {
          s = v;
        }},{get: function () {
          return x;
        }, set: function (v) {
          x = v;
        }},{get: function () {
          return y;
        }, set: function (v) {
          y = v;
        }});
      SectorSize = pas.ldconfig.Config.SectorSize;
      bb = $mod.TBillboard.$create("Create$2",[ATile,(x + 0.5) * SectorSize,(y + 0.5) * SectorSize,AWidth,AHeight,ASprite,AAnimation]);
      pas.GameBase.Game().AddElement(bb).fVisible = false;
      bbs.push(bb);
      Result = bb;
      return Result;
    };
    this.RemoveBillboard = function (ATile, ABillboard) {
      var bbs = null;
      var idx = 0;
      bbs = this.GetData(ATile).get("billboards");
      idx = bbs.indexOf(ABillboard);
      if (idx > -1) bbs.splice(idx,1);
      pas.GameBase.Game().RemoveElement(ABillboard,true);
    };
    this.GetItems = function (AEntity) {
      var Result = null;
      Result = this.GetData(AEntity).get("billboards");
      return Result;
    };
    this.SetBillboardsVisible = function (AEntity, AVisible) {
      var bbs = null;
      var o = undefined;
      bbs = this.GetData(AEntity).get("billboards");
      for (var $in = bbs, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        o = $in[$l];
        rtl.getObject(o).fVisible = AVisible;
      };
    };
  });
  rtl.createClass(this,"THarvestable",pas.ECS.TECComponent,function () {
  });
  rtl.createClass(this,"TField",pas.ECS.TECComponent,function () {
    this.Sprite = function () {
      var Result = null;
      Result = pas.GameSprite.GetSprite("barley");
      return Result;
    };
    this.GetMax = function () {
      var Result = 0;
      Result = 3;
      return Result;
    };
    this.Init = function (AEntity) {
      var plants = null;
      var el = undefined;
      var i = 0;
      var sec = 0;
      var y = 0;
      var x = 0;
      pas.ECS.TECComponent.Init.call(this,AEntity);
      plants = new Array();
      $mod.TileComp.GetInfo(AEntity,{get: function () {
          return sec;
        }, set: function (v) {
          sec = v;
        }},{get: function () {
          return x;
        }, set: function (v) {
          x = v;
        }},{get: function () {
          return y;
        }, set: function (v) {
          y = v;
        }});
      for (i = 0; i <= 19; i++) plants.push($mod.TPlant.$create("Create$2",[(x + Math.random()) * pas.ldconfig.Config.SectorSize,(y + Math.random()) * pas.ldconfig.Config.SectorSize,this.Sprite(),this.GetMax()]));
      for (var $in = plants, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        el = $in[$l];
        pas.GameBase.Game().AddElement(rtl.getObject(el)).fVisible = false;
      };
      this.GetData(AEntity).set("plants",plants);
    };
    this.DeInit = function (AEntity) {
      var plants = null;
      var el = undefined;
      pas.ECS.TECComponent.DeInit.call(this,AEntity);
      plants = this.GetData(AEntity).get("plants");
      for (var $in = plants, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        el = $in[$l];
        pas.GameBase.Game().RemoveElement(rtl.getObject(el),true);
      };
    };
    this.Update = function (AEntity, ADeltaMS, ATimeMS) {
      pas.ECS.TECComponent.Update.call(this,AEntity,ADeltaMS,ATimeMS);
    };
    this.GetPlants = function (AEntity) {
      var Result = null;
      Result = this.GetData(AEntity).get("plants");
      return Result;
    };
    this.SetPlantsVisible = function (AEntity, AVisible) {
      var el = undefined;
      var plants = null;
      plants = this.GetData(AEntity).get("plants");
      for (var $in = plants, $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        el = $in[$l];
        rtl.getObject(el).fVisible = AVisible;
      };
    };
  });
  rtl.createClass(this,"THops",this.TField,function () {
    this.Sprite = function () {
      var Result = null;
      Result = pas.GameSprite.GetSprite("hops");
      return Result;
    };
    this.GetMax = function () {
      var Result = 0;
      Result = 5;
      return Result;
    };
  });
  this.Map = null;
  this.SectorArrows = rtl.arraySetLength(null,null,4);
  this.LoadTiles = function (AInfo) {
    $impl.TileInfo = $mod.TLDMapTiles.$create("Create$1",[AInfo]);
  };
  this.UpdateNeighbourSectors = function () {
    var x = 0;
    var y = 0;
    x = $mod.Map.fCurrentSector.fX;
    y = $mod.Map.fCurrentSector.fY;
    $mod.SectorArrows[0].fAvail = $mod.Map.HasSector(x,y - 1);
    $mod.SectorArrows[1].fAvail = $mod.Map.HasSector(x + 1,y);
    $mod.SectorArrows[2].fAvail = $mod.Map.HasSector(x,y + 1);
    $mod.SectorArrows[3].fAvail = $mod.Map.HasSector(x - 1,y);
  };
  this.FieldComp = null;
  this.HopsComp = null;
  this.TileComp = null;
  $mod.$implcode = function () {
    $impl.Sectors = 0;
    $impl.TileInfo = null;
    $impl.Behaviors = null;
    $impl.GetGrowthRect = function (ACenter, AWidth, AHeight) {
      var Result = rtl.arraySetLength(null,pas.GameMath.TPVector,4);
      Result[0].$assign(ACenter.Add(pas.GameMath.TPVector.New(-AWidth / 2,0,AHeight)));
      Result[1].$assign(ACenter.Add(pas.GameMath.TPVector.New(AWidth / 2,0,AHeight)));
      Result[2].$assign(ACenter.Add(pas.GameMath.TPVector.New(AWidth / 2,0,0)));
      Result[3].$assign(ACenter.Add(pas.GameMath.TPVector.New(-AWidth / 2,0,0)));
      return Result;
    };
    $impl.MakeSecButtonQuad = function (Width, Height) {
      var Result = rtl.arraySetLength(null,pas.GameMath.TPVector,4);
      var SectorSize = 0;
      SectorSize = pas.ldconfig.Config.SectorSize;
      Result[3].$assign(pas.GameMath.TPVector.New((1.5 * SectorSize) + (Width / 2),-20 - (0 * Height),0));
      Result[0].$assign(pas.GameMath.TPVector.New((1.5 * SectorSize) + (Width / 2),-20 - (1 * Height),0));
      Result[1].$assign(pas.GameMath.TPVector.New((1.5 * SectorSize) - (Width / 2),-20 - (1 * Height),0));
      Result[2].$assign(pas.GameMath.TPVector.New((1.5 * SectorSize) - (Width / 2),-20 - (0 * Height),0));
      return Result;
    };
    $impl.MakeTileQuad = function (X, Y) {
      var Result = rtl.arraySetLength(null,pas.GameMath.TPVector,4);
      var SectorSize = 0;
      SectorSize = pas.ldconfig.Config.SectorSize;
      Result[0].$assign(pas.GameMath.TPVector.New(X * SectorSize,(Y + 1) * SectorSize,0));
      Result[1].$assign(pas.GameMath.TPVector.New((X + 1) * SectorSize,(Y + 1) * SectorSize,0));
      Result[2].$assign(pas.GameMath.TPVector.New((X + 1) * SectorSize,Y * SectorSize,0));
      Result[3].$assign(pas.GameMath.TPVector.New(X * SectorSize,Y * SectorSize,0));
      return Result;
    };
  };
  $mod.$init = function () {
    $mod.TileComp = pas.ECS.EntitySystem.RegisterComponent($mod.TTileComponent);
    $impl.Behaviors = new Map();
    $impl.Behaviors.set("harvestable",pas.ECS.EntitySystem.RegisterComponent($mod.THarvestable));
    $mod.FieldComp = pas.ECS.EntitySystem.RegisterComponent($mod.TField);
    $mod.HopsComp = pas.ECS.EntitySystem.RegisterComponent($mod.THops);
    $impl.Behaviors.set("field",$mod.FieldComp);
    $impl.Behaviors.set("hops",$mod.HopsComp);
    $mod.Map = $mod.TLDMap.$create("Create$2");
  };
},["ldactor"]);
rtl.module("program",["System","Math","Web","webgl","JS","Classes","SysUtils","resources","guibase","guictrls","GameBase","gameaudio","GameMath","GameSprite","ECS","GameFont","ldmap","ldactor","ldconfig","ldai","ldsounds"],function () {
  "use strict";
  var $mod = this;
  rtl.createClass(this,"TText",pas.GameBase.TGameElement,function () {
    this.$init = function () {
      pas.GameBase.TGameElement.$init.call(this);
      this.r = 0.0;
    };
    this.Update = function (AGame, ATimeMS) {
      pas.GameBase.TGameElement.Update.call(this,AGame,ATimeMS);
      this.r = ATimeMS;
    };
    this.Render = function (gl, AViewport) {
      var res = pas.GameFont.TTextRun.$new();
      var v = pas.GameBase.TGameViewport.$new();
      res.$assign(pas.GameFont.GetFont("sans").Draw("Click here to start"));
      v.$assign(AViewport);
      v.Projection = pas.GameMath.TPMatrix.$create("Ortho",[-pas.GameBase.Game().fWidth / 2,pas.GameBase.Game().fWidth / 2,pas.GameBase.Game().fHeight / 2,-pas.GameBase.Game().fHeight / 2,-10,10]);
      v.ModelView = pas.GameMath.TPMatrix.$create("Identity").Multiply$1(pas.GameMath.TPMatrix.$create("CreateTranslation",[-res.Width / 2,-res.Height / 2,0]));
      pas.GameFont.TGameFont.Render(gl,pas.GameFont.TTextRun.$clone(res),pas.GameBase.TGameViewport.$clone(v),pas.GameBase.TGameColor.$clone(pas.GameBase.TGameColor.New(1,1,1,1.0)),1);
    };
  });
  this.TLDGameState = {"0": "gsIntro", gsIntro: 0, "1": "gsMain", gsMain: 1, "2": "gsDialog", gsDialog: 2};
  this.TAction = {"0": "aMove", aMove: 0, "1": "aAttack", aAttack: 1, "2": "aTalk", aTalk: 2, "3": "aUse", aUse: 3, "4": "aPickUp", aPickUp: 4, "5": "aDrop", aDrop: 5};
  rtl.createClass(this,"TLD49Game",pas.GameBase.TGameBase,function () {
    this.$init = function () {
      pas.GameBase.TGameBase.$init.call(this);
      this.fCurrentAction = 0;
      this.StartSector = null;
      this.State = 0;
      this.IntroElements = null;
      this.DialogElements = null;
      this.DialogGUI = null;
      this.DialogBackH = null;
      this.DialogIcon = null;
      this.DialogText = null;
      this.DialogOptions = null;
      this.DialogTarget = undefined;
      this.DialogStack = null;
      this.DialogCfg = null;
      this.StatusLabel = null;
      this.MainGUI = null;
      this.MainGuiPanel = null;
      this.InvPanel = null;
      this.InvGoldLabel = null;
      this.Inventory = null;
      this.Actions = rtl.arraySetLength(null,null,6);
      this.fCurrentTrack = 0;
      this.Tracks = rtl.arraySetLength(null,null,2);
      this.fCurrentMusic = null;
    };
    this.$final = function () {
      this.StartSector = undefined;
      this.IntroElements = undefined;
      this.DialogElements = undefined;
      this.DialogGUI = undefined;
      this.DialogBackH = undefined;
      this.DialogIcon = undefined;
      this.DialogText = undefined;
      this.DialogOptions = undefined;
      this.DialogStack = undefined;
      this.DialogCfg = undefined;
      this.StatusLabel = undefined;
      this.MainGUI = undefined;
      this.MainGuiPanel = undefined;
      this.InvPanel = undefined;
      this.InvGoldLabel = undefined;
      this.Inventory = undefined;
      this.Actions = undefined;
      this.Tracks = undefined;
      this.fCurrentMusic = undefined;
      pas.GameBase.TGameBase.$final.call(this);
    };
    this.SetAction = function (ATarget, APosition) {
      this.SetCurrentAction(ATarget.fTag);
    };
    this.SetCurrentAction = function (AValue) {
      if (this.fCurrentAction === AValue) return;
      this.Actions[this.fCurrentAction].fColor.$assign(pas.GameBase.TGameColor.New(1,1,1,1.0));
      this.fCurrentAction = AValue;
      this.Actions[AValue].fColor.$assign(pas.GameBase.TGameColor.New(1,1,0,1.0));
    };
    this.HasBeer = function () {
      var Result = false;
      Result = (this.Inventory.ElementCount(pas.GameSprite.GetSprite("icon-beer-reg")) > 0) || (this.Inventory.ElementCount(pas.GameSprite.GetSprite("icon-beer-med")) > 0) || (this.Inventory.ElementCount(pas.GameSprite.GetSprite("icon-beer-strong")) > 0) || (this.Inventory.ElementCount(pas.GameSprite.GetSprite("icon-beer-suicide")) > 0);
      return Result;
    };
    this.WantsBeer = function (ATarget) {
      var Result = false;
      Result = true;
      return Result;
    };
    this.ClickDialog = function (AIndex) {
      var $Self = this;
      var curr = null;
      var selected = null;
      function Consume(agrain, ahops, awater) {
        $Self.Inventory.RemoveElements(pas.GameSprite.GetSprite("icon-barley"),agrain);
        $Self.Inventory.RemoveElements(pas.GameSprite.GetSprite("icon-hops"),ahops);
        $Self.Inventory.RemoveElements(pas.GameSprite.GetSprite("icon-full-bucket"),awater);
        $Self.Inventory.AddElements(pas.GameSprite.GetSprite("icon-bucket"),awater);
      };
      curr = this.DialogStack[this.DialogStack.length - 1];
      if (AIndex === -1) {
        this.DialogStack.splice(this.DialogStack.length - 1);
        if (this.DialogStack.length > 0) {
          this.TriggerDialog$1(this.DialogStack[this.DialogStack.length - 1],false)}
         else this.State = 1;
      } else {
        selected = curr["entries"][AIndex];
        if (selected["subdialog"] != undefined) {
          this.TriggerDialog$1(this.DialogCfg["" + selected["subdialog"]],true);
        } else if (selected["trigger"] != undefined) {
          this.State = 1;
          this.DialogStack = new Array();
          var $tmp = "" + selected["trigger"];
          if ($tmp === "buy_harvest") {}
          else if ($tmp === "buy_beer") {}
          else if ($tmp === "give_beer") {}
          else if ($tmp === "brew_pilsner") {
            Consume(10,3,1);
            this.Inventory.AddElements(pas.GameSprite.GetSprite("icon-beer-reg"),2);
          } else if ($tmp === "brew_ale") {
            Consume(15,4,1);
            this.Inventory.AddElements(pas.GameSprite.GetSprite("icon-beer-med"),2);
          } else if ($tmp === "brew_porter") {
            Consume(30,10,1);
            this.Inventory.AddElements(pas.GameSprite.GetSprite("icon-beer-strong"),2);
          };
        } else pas.System.Writeln("Dead end?!");
      };
    };
    this.TriggerDialog = function (ATarget, ADialog, APush) {
      var curr = null;
      this.State = 2;
      this.DialogTarget = ATarget;
      curr = this.DialogCfg[ADialog];
      this.TriggerDialog$1(curr,APush);
    };
    this.TriggerDialog$1 = function (ADialog, APush) {
      var ent2 = null;
      var ent = undefined;
      var idx = 0;
      var avail = false;
      if (APush) this.DialogStack.push(ADialog);
      this.DialogIcon.fSprite = pas.GameSprite.GetSprite("" + ADialog["icon"]);
      this.DialogIcon.fAnimation = "" + ADialog["animation"];
      this.DialogText.SetCaption("" + ADialog["start"]);
      this.DialogOptions.Clear();
      idx = 0;
      for (var $in = ADialog["entries"], $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        ent = $in[$l];
        ent2 = ent;
        avail = true;
        if (ent2["gold"] != undefined) avail = avail && (rtl.trunc(ent2["gold"]) <= pas.ldactor.Player.fGold);
        if (ent2["beer"] != undefined) avail = avail && this.HasBeer() && this.WantsBeer(this.DialogTarget);
        if (ent2["grain"] != undefined) avail = avail && (this.Inventory.ElementCount(pas.GameSprite.GetSprite("icon-barley")) >= rtl.trunc(ent2["grain"]));
        if (ent2["hops"] != undefined) avail = avail && (this.Inventory.ElementCount(pas.GameSprite.GetSprite("icon-hops")) >= rtl.trunc(ent2["hops"]));
        if (ent2["water"] != undefined) avail = avail && (this.Inventory.ElementCount(pas.GameSprite.GetSprite("icon-full-bucket")) >= rtl.trunc(ent2["water"]));
        if (avail) this.DialogOptions.AddItem(idx,"" + ent2["option"]);
        idx += 1;
      };
      if (ADialog["no_exit"] == undefined) this.DialogOptions.AddItem(-1,"Back");
    };
    var DW = 800;
    var DH = 600;
    this.MakeDialog = function () {
      var DialogPanel = null;
      this.DialogGUI = pas.guibase.TGUI.$create("Create$2");
      this.DialogGUI.Resize(this.fWidth,this.fHeight);
      this.DialogElements = new Array();
      this.DialogElements.push(this.DialogGUI);
      this.DialogBackH = pas.guictrls.TGUIPanel.$create("Create$3");
      this.DialogBackH.SetSize(0,0,this.fWidth,this.fHeight);
      this.DialogBackH.fBackGround.$assign(pas.GameBase.TGameColor.New(0.3,0.3,0.3,1.0));
      this.DialogGUI.AddChild(this.DialogBackH);
      DialogPanel = pas.guictrls.TGUIPanel.$create("Create$3");
      DialogPanel.fBackGround.$assign(pas.GameBase.TGameColor.New(0.8,0.8,0.8,1.0));
      DialogPanel.SetSize(rtl.trunc((this.fWidth - 800) / 2),rtl.trunc((this.fHeight - 600) / 2),800,600);
      this.DialogGUI.AddChild(DialogPanel);
      this.DialogIcon = pas.guictrls.TGUIImage.$create("Create$2");
      this.DialogIcon.SetSize(0,0,256,256);
      DialogPanel.AddChild(this.DialogIcon);
      this.DialogText = pas.guictrls.TGUILabel.$create("Create$3");
      this.DialogText.SetSize(256,0,800 - 256,600 - (5 * 30));
      this.DialogText.SetFontSize(30);
      this.DialogText.SetFont("sans");
      this.DialogText.SetCaption("test");
      DialogPanel.AddChild(this.DialogText);
      this.DialogOptions = pas.guictrls.TGUIDialogs.$create("Create$4");
      this.DialogOptions.SetSize(0,600 - (5 * 30),800,5 * 30);
      this.DialogOptions.fItemHeight = 30;
      this.DialogOptions.fBackGround.$assign(pas.GameBase.TGameColor.New(0.85,0.85,0.85,1.0));
      this.DialogOptions.fHoverColor.$assign(pas.GameBase.TGameColor.New(1,1,1,1.0));
      this.DialogOptions.fOnClickItem = rtl.createCallback(this,"ClickDialog");
      DialogPanel.AddChild(this.DialogOptions);
    };
    this.AddInventory = function (ASprite, ACount) {
      this.Inventory.AddElements(pas.GameSprite.GetSprite(ASprite),ACount);
    };
    this.HasInventory = function (ASprite, ACount) {
      var Result = false;
      Result = this.Inventory.ElementCount(pas.GameSprite.GetSprite(ASprite)) >= ACount;
      return Result;
    };
    this.RemoveInventory = function (ASprite, ACount) {
      var Result = false;
      Result = this.Inventory.RemoveElements(pas.GameSprite.GetSprite(ASprite),ACount);
      return Result;
    };
    this.DropItem = function (AName, ASector, APosition) {
      var fCurrentTile = null;
      var bb = null;
      fCurrentTile = ASector.GetTileAt(pas.GameMath.TPVector.$clone(APosition));
      bb = pas.ldmap.TileComp.AddBillboard(fCurrentTile,pas.GameSprite.GetSprite(AName),"idle",20,20);
      bb.fPosition.$assign(APosition);
      bb.fIsItem = true;
      bb.fVisible = true;
    };
    this.ClickInventory = function (AItem) {
      var s = 0.0;
      var $tmp = this.fCurrentAction;
      if ($tmp === 5) {
        this.RemoveInventory(AItem.fName,1);
        this.DropItem(AItem.fName,pas.ldmap.Map.fCurrentSector,pas.GameMath.TPVector.$clone(pas.ldactor.Player.fPosition));
        this.fAudio.Play(pas.resources.TResources.AddSound("assets\/Audio\/proc_plop.m4a"),1,false);
      } else if ($tmp === 3) {
        var $tmp1 = AItem.fName;
        if ($tmp1 === "icon-beer-reg") {
          s = 0.5}
         else if ($tmp1 === "icon-beer-med") {
          s = 1.0}
         else if ($tmp1 === "icon-beer-strong") {
          s = 2.0}
         else if ($tmp1 === "icon-beer-suicide") s = 5;
        var $tmp2 = AItem.fName;
        if ($tmp2 === "icon-paper") {
          this.TriggerDialog(null,"instructions",true);
          this.RemoveInventory(AItem.fName,1);
        } else if (($tmp2 === "icon-beer-reg") || ($tmp2 === "icon-beer-med") || ($tmp2 === "icon-beer-strong") || ($tmp2 === "icon-beer-suicide")) {
          pas.ldactor.Player.DrinkBeer(s);
          pas.GameBase.Game().fAudio.Play(pas.ldsounds.GetSound("drink"),0.8,false);
          this.RemoveInventory(AItem.fName,1);
        } else {
          this.WriteStatus("You can't do that");
        };
      } else {
        this.WriteStatus("You can't do that");
      };
    };
    this.WriteStatus = function (AMessage) {
      this.StatusLabel.SetCaption(AMessage);
      this.StatusLabel.fColor.$assign(pas.GameBase.TGameColor.New(1,1,1,1.0));
      pas.System.Writeln(AMessage);
    };
    this.FindBBsInSector = function () {
      var Result = null;
      var i = 0;
      var i2 = 0;
      Result = new Array();
      for (var $l = 0, $end = pas.ldconfig.Config.SectorTiles - 1; $l <= $end; $l++) {
        i = $l;
        for (var $l1 = 0, $end1 = pas.ldconfig.Config.SectorTiles - 1; $l1 <= $end1; $l1++) {
          i2 = $l1;
          Result = Result.concat(pas.ldmap.TileComp.GetItems(pas.ldmap.Map.fCurrentSector.fTiles[i][i2]));
        };
      };
      return Result;
    };
    this.FindNPC = function (ATarget) {
      var $Self = this;
      var Result = null;
      var things = null;
      Result = null;
      things = pas.ldactor.CharactersVisible;
      things = things.filter(function (e, i, a) {
        var Result = false;
        Result = rtl.getObject(e).GetAlive() && (rtl.getObject(e) !== pas.ldactor.Player) && (rtl.getObject(e).fPosition.Sub(ATarget).LengthSqr() < pas.System.Sqr$1(pas.ldconfig.Config.PlayerReach));
        return Result;
      });
      if (things.length <= 0) return null;
      things = things.sort(function (a, b) {
        var Result = 0;
        Result = Math.round(rtl.getObject(a).fPosition.Sub(ATarget).LengthSqr()) - Math.round(rtl.getObject(b).fPosition.Sub(ATarget).LengthSqr());
        return Result;
      });
      Result = rtl.getObject(things[0]);
      return Result;
    };
    this.FindUseTarget = function (ATarget) {
      var $Self = this;
      var Result = null;
      var things = null;
      Result = null;
      things = this.FindBBsInSector();
      things = things.filter(function (e, i, a) {
        var Result = false;
        Result = !rtl.getObject(e).fIsItem && (rtl.getObject(e).fPosition.Sub(ATarget).LengthSqr() < pas.System.Sqr$1(pas.ldconfig.Config.PlayerReach));
        return Result;
      });
      if (things.length <= 0) return null;
      things = things.sort(function (a, b) {
        var Result = 0;
        Result = Math.round(rtl.getObject(a).fPosition.Sub(ATarget).LengthSqr()) - Math.round(rtl.getObject(b).fPosition.Sub(ATarget).LengthSqr());
        return Result;
      });
      Result = rtl.getObject(things[0]);
      return Result;
    };
    this.FindItemTarget = function (ATarget) {
      var $Self = this;
      var Result = null;
      var things = null;
      Result = null;
      things = this.FindBBsInSector();
      things = things.filter(function (e, i, a) {
        var Result = false;
        Result = rtl.getObject(e).fIsItem && (rtl.getObject(e).fPosition.Sub(ATarget).LengthSqr() < pas.System.Sqr$1(pas.ldconfig.Config.PlayerReach));
        return Result;
      });
      if (things.length <= 0) return null;
      things = things.sort(function (a, b) {
        var Result = 0;
        Result = Math.round(rtl.getObject(a).fPosition.Sub(ATarget).LengthSqr()) - Math.round(rtl.getObject(b).fPosition.Sub(ATarget).LengthSqr());
        return Result;
      });
      Result = rtl.getObject(things[0]);
      return Result;
    };
    this.FindHarvestTarget = function (ATarget) {
      var $Self = this;
      var Result = null;
      var tile = null;
      var plants = null;
      tile = pas.ldmap.Map.fCurrentSector.GetTileAt(pas.GameMath.TPVector.$clone(ATarget));
      plants = new Array();
      if (tile.HasComponent(pas.ldmap.FieldComp)) {
        plants = pas.ldmap.FieldComp.GetPlants(tile)}
       else if (tile.HasComponent(pas.ldmap.HopsComp)) plants = pas.ldmap.HopsComp.GetPlants(tile);
      plants = plants.filter(function (e, i, a) {
        var Result = false;
        Result = rtl.getObject(e).GetReady() && (rtl.getObject(e).fPosition.Sub(ATarget).LengthSqr() < pas.System.Sqr$1(pas.ldconfig.Config.PlayerReach));
        return Result;
      });
      if (plants.length <= 0) return null;
      plants = plants.sort(function (a, b) {
        var Result = 0;
        Result = Math.round(rtl.getObject(a).fPosition.Sub(ATarget).LengthSqr()) - Math.round(rtl.getObject(b).fPosition.Sub(ATarget).LengthSqr());
        return Result;
      });
      Result = rtl.getObject(plants[0]);
      return Result;
    };
    this.PerformAction = function (ATarget) {
      var targ = null;
      var targharvest = null;
      var char = null;
      var $tmp = this.fCurrentAction;
      if ($tmp === 1) {
        pas.ldactor.Player.TriggerAttack()}
       else if ($tmp === 2) {
        char = this.FindNPC(pas.GameMath.TPVector.$clone(ATarget));
        if (char !== null) {
          this.TriggerDialog(char,char.fName,true);
        } else this.WriteStatus("No one to talk to here");
      } else if ($tmp === 3) {
        targ = this.FindUseTarget(pas.GameMath.TPVector.$clone(ATarget));
        if (targ !== null) {
          var $tmp1 = targ.fSprite.fName;
          if ($tmp1 === "well") {
            if (this.RemoveInventory("icon-bucket",1)) {
              this.AddInventory("icon-full-bucket",1);
              this.fAudio.Play(pas.ldsounds.GetSound("drop"),1,false);
            } else this.WriteStatus("You need a bucket for the water");
          } else if ($tmp1 === "fireplace") {
            this.TriggerDialog(null,"cauldron",true)}
           else {
            targ = null;
          };
        } else {
          this.WriteStatus("Nothing to use here");
          return;
        };
        if (targ === null) {
          this.WriteStatus("Can not use this");
          return;
        };
      } else if ($tmp === 4) {
        targ = this.FindItemTarget(pas.GameMath.TPVector.$clone(ATarget));
        targharvest = null;
        if (targ === null) targharvest = this.FindHarvestTarget(pas.GameMath.TPVector.$clone(ATarget));
        if (targ !== null) {
          this.AddInventory(targ.fSprite.fName,1);
          pas.ldmap.TileComp.RemoveBillboard(targ.fTile,targ);
          this.fAudio.Play(pas.ldsounds.GetSound("pickup"),1,false);
        } else if (targharvest !== null) {
          if (this.HasInventory("icon-scythe",1)) {
            pas.ldactor.DamageAt(pas.ldactor.Player,pas.ldmap.Map.fCurrentSector.fID,pas.GameMath.TPVector.$clone(pas.ldactor.Player.fPosition),10,true);
            targharvest.Harvest();
            if (targharvest.GetName() === "barley") {
              this.AddInventory("icon-barley",pas.ldconfig.Config.BarleyHarvest)}
             else this.AddInventory("icon-hops",pas.ldconfig.Config.HopsHarvest);
            this.fAudio.Play(pas.ldsounds.GetSound("harvest"),1,false);
          } else this.WriteStatus("You do not have anything to harvest this with");
        } else this.WriteStatus("Nothing to pick up here");
      } else if ($tmp === 5) ;
    };
    this.ScreenToWorld = function (APoint) {
      var Result = pas.GameMath.TPVector.$new();
      Result.$assign(this.Viewport.ModelView.GetInverse().Transpose().Multiply(this.Viewport.Projection.GetInverse().Transpose().Multiply(APoint)));
      return Result;
    };
    this.WindowToGround = function (APoint) {
      var Result = pas.GameMath.TPVector.$new();
      var p = pas.GameMath.TPVector.$new();
      var pt = pas.GameMath.TPVector.$new();
      var pt2 = pas.GameMath.TPVector.$new();
      var dir = pas.GameMath.TPVector.$new();
      var t = 0.0;
      p.$assign(pas.GameMath.TPVector.New(APoint.X,APoint.Y,0).Multiply(pas.GameMath.TPVector.New(2 / this.fWidth,-2 / this.fHeight,1.0)).Sub(pas.GameMath.TPVector.New(1,-1,0)));
      pt.$assign(this.ScreenToWorld(p));
      pt2.$assign(this.ScreenToWorld(p.Sub(pas.GameMath.TPVector.New(0,0,2))));
      dir.$assign(pt2.Sub(pt));
      t = -pt.Z / dir.Z;
      Result.$assign(pt.Add(dir.Scale(t)));
      return Result;
    };
    this.LoadMap = function (AStr) {
      var info = null;
      var obj = null;
      var o2 = null;
      var sector = "";
      var Default = "";
      var tile = "";
      var typ = "";
      var location = null;
      var idx = 0;
      var x = 0;
      var y = 0;
      var sec = null;
      var spawn = undefined;
      var ch = null;
      info = JSON.parse(AStr);
      for (var $in = Object.keys(info), $l = 0, $end = rtl.length($in) - 1; $l <= $end; $l++) {
        sector = $in[$l];
        obj = info[sector];
        Default = "" + obj["default"];
        location = obj["location"];
        sec = pas.ldmap.Map.GetSector(rtl.trunc(location[0]),rtl.trunc(location[1]));
        for (var $in1 = Object.keys(obj), $l1 = 0, $end1 = rtl.length($in1) - 1; $l1 <= $end1; $l1++) {
          tile = $in1[$l1];
          var $tmp = tile;
          if (($tmp === "location") || ($tmp === "default")) {}
          else {
            idx = pas.SysUtils.StrToInt(tile);
            o2 = obj[tile];
            typ = "" + $mod.iff(o2["tile"],Default);
            x = idx % pas.ldconfig.Config.SectorTiles;
            y = rtl.trunc(idx / pas.ldconfig.Config.SectorTiles);
            sec.SetTile$1(x,y,typ);
            for (var $in2 = $mod.iff(o2["spawn"],new Array()), $l2 = 0, $end2 = rtl.length($in2) - 1; $l2 <= $end2; $l2++) {
              spawn = $in2[$l2];
              ch = pas.ldactor.SpawnCharacter(pas.ldactor.GetName(),"" + spawn,sec.fID,x * pas.ldconfig.Config.SectorSize,y * pas.ldconfig.Config.SectorSize);
              var $tmp1 = "" + spawn;
              if ($tmp1 === "farmer") {
                pas.ldai.FarmerBehavior.SetHomeTile(ch.fActor,sec.fID,x,y)}
               else if ($tmp1 === "guard") {
                pas.ldai.GuardBehavior.SetHomeTile(ch.fActor,sec.fID,x,y)}
               else if ($tmp1 === "player") {
                this.StartSector = sec;
                pas.ldactor.Player = ch;
              } else if ($tmp1 === "king") {
                pas.ldactor.King = ch;
                pas.ldai.KingBehavior.SetHomeTile(ch.fActor,sec.fID,x,y);
              };
            };
          };
        };
      };
    };
    this.MakeGUI = function () {
      var $Self = this;
      var t = null;
      var ActionPanel = null;
      var PanelBG = pas.GameBase.TGameColor.$new();
      function AddAction(AAction, ACaption, AX, AY) {
        var btn = null;
        btn = pas.guictrls.TGUILabel.$create("Create$3");
        btn.SetCaption(ACaption);
        btn.SetSize(AX,AY,175,50);
        btn.SetFontSize(50);
        btn.fColor.$assign(pas.GameBase.TGameColor.New(1,1,1,1.0));
        ActionPanel.AddChild(btn);
        $Self.Actions[AAction] = btn;
        btn.fTag = AAction;
        btn.fOnClick = rtl.createCallback($Self,"SetAction");
      };
      this.StatusLabel = pas.guictrls.TGUILabel.$create("Create$3");
      this.MainGUI.AddChild(this.StatusLabel);
      this.StatusLabel.SetFont("sans");
      this.StatusLabel.SetFontSize(30);
      this.StatusLabel.SetCaption("");
      this.StatusLabel.fColor.$assign(pas.GameBase.TGameColor.Transparent());
      this.StatusLabel.fHitTestVisible = false;
      PanelBG.$assign(pas.GameBase.TGameColor.New(0.4,0.4,0.4,1.0));
      this.MainGUI.fPosition.$assign(pas.GameMath.TPVector.New(0,0,1));
      this.MainGuiPanel = pas.guictrls.TGUIPanel.$create("Create$3");
      this.MainGuiPanel.SetSize(0,this.fHeight - 200,this.fWidth,200);
      this.MainGuiPanel.fBackGround.$assign(pas.GameBase.TGameColor.New(1,0,0,1.0));
      this.MainGUI.AddChild(this.MainGuiPanel);
      this.InvPanel = pas.guictrls.TGUIPanel.$create("Create$3");
      this.InvPanel.SetSize(0,2,350,200 - 2);
      this.InvPanel.fBackGround.$assign(PanelBG);
      this.MainGuiPanel.AddChild(this.InvPanel);
      t = pas.guictrls.TGUILabel.$create("Create$3");
      t.SetCaption("Inventory");
      t.SetSize(0,0,350,30);
      t.SetFontSize(30);
      this.InvPanel.AddChild(t);
      this.InvGoldLabel = pas.guictrls.TGUILabel.$create("Create$3");
      this.InvGoldLabel.SetCaption("Gold: 0");
      this.InvGoldLabel.SetSize(0,30,350,30);
      this.InvGoldLabel.SetFontSize(30);
      this.InvPanel.AddChild(this.InvGoldLabel);
      this.Inventory = pas.guictrls.TGUIInventory.$create("Create$3");
      this.Inventory.fItemWidth = rtl.trunc(350 / 3);
      this.Inventory.SetSize(0,60,350,200 - 60);
      this.Inventory.fHoverColor.$assign(pas.GameBase.TGameColor.New(0.6,0.6,0.6,1.0));
      this.InvPanel.AddChild(this.Inventory);
      this.Inventory.fOnClickItem = rtl.createCallback($Self,"ClickInventory");
      this.AddInventory("icon-beer-reg",1);
      this.AddInventory("icon-paper",1);
      ActionPanel = pas.guictrls.TGUIPanel.$create("Create$3");
      ActionPanel.SetSize(352,2,350,200 - 2);
      ActionPanel.fBackGround.$assign(PanelBG);
      this.MainGuiPanel.AddChild(ActionPanel);
      AddAction(0,"Move",0,0);
      AddAction(1,"Attack",175,0);
      AddAction(2,"Talk",0,50);
      AddAction(3,"Use",175,50);
      AddAction(4,"Pick up",0,100);
      AddAction(5,"Drop",175,100);
      this.SetCurrentAction(1);
      this.SetCurrentAction(0);
    };
    this.MusicEnded = function (ASrc) {
      this.fCurrentMusic.FadeOut($mod.fTime,1);
      this.fCurrentTrack = (this.fCurrentTrack + 1) % 2;
      this.fCurrentMusic = this.fAudio.Play(this.Tracks[this.fCurrentTrack],0.4,false);
      this.fCurrentMusic.fOnEnd = rtl.createCallback(this,"MusicEnded");
    };
    this.StartMusic = function () {
      this.fCurrentTrack = 0;
      this.fCurrentMusic = this.fAudio.Play(this.Tracks[0],0.4,false);
      this.fCurrentMusic.fOnEnd = rtl.createCallback(this,"MusicEnded");
    };
    this.Update = function (ATimeMS) {
      var x = pas.GameBase.TGameColor.$new();
      pas.GameBase.TGameBase.Update.call(this,ATimeMS);
      this.InvGoldLabel.SetCaption(pas.SysUtils.Format("Gold: %d",pas.System.VarRecs(0,pas.ldactor.Player.fGold)));
      if ((this.State === 1) && !pas.ldactor.Player.GetAlive()) this.TriggerDialog(undefined,"dead",true);
      if ((this.State === 1) && !pas.ldactor.King.GetAlive()) this.TriggerDialog(undefined,"king-dead",true);
      x.$assign(this.StatusLabel.fColor);
      x.A = x.A - ((ATimeMS - $mod.fTime) / 1000);
      if (x.A < 0) x.A = 0;
      this.StatusLabel.fColor.$assign(x);
      $mod.fTime = ATimeMS;
    };
    this.GetElements = function () {
      var Result = null;
      var $tmp = this.State;
      if ($tmp === 0) {
        Result = this.IntroElements}
       else if ($tmp === 1) {
        Result = pas.GameBase.TGameBase.GetElements.call(this)}
       else if ($tmp === 2) Result = this.DialogElements;
      return Result;
    };
    this.DoKeyPress = function (AKeyCode) {
      var $tmp = AKeyCode;
      if ($tmp === "Escape") {
        this.SetCurrentAction(0)}
       else if ($tmp === "Digit1") {
        this.SetCurrentAction(0)}
       else if ($tmp === "Digit2") {
        this.SetCurrentAction(1)}
       else if ($tmp === "Digit3") {
        this.SetCurrentAction(2)}
       else if ($tmp === "Digit4") {
        this.SetCurrentAction(3)}
       else if ($tmp === "Digit5") {
        this.SetCurrentAction(4)}
       else if ($tmp === "Digit6") {
        this.SetCurrentAction(5)}
       else if ($tmp === "KeyM") {
        this.fAudio.FadeAll($mod.fTime,400)}
       else if ($tmp === "KeyN") {
        this.MusicEnded(null)}
       else if ($tmp === "KeyF") {
        this.fAudio.Play(pas.ldsounds.GetSound("burp"),0.3,false)}
       else {
        pas.System.Writeln(AKeyCode);
      };
    };
    this.DoClick = function (AX, AY, AButtons) {
      var p = pas.GameMath.TPVector.$new();
      var h = false;
      pas.GameBase.TGameBase.DoClick.call(this,AX,AY,AButtons);
      var $tmp = this.State;
      if ($tmp === 0) {
        this.State = 1;
        this.StartMusic();
      } else if ($tmp === 1) {
        this.MainGUI.DoClick(pas.guibase.TGUIPoint.$clone(pas.guibase.TGUIPoint.Create(AX,AY)),{get: function () {
            return h;
          }, set: function (v) {
            h = v;
          }});
        if (!h) {
          p.$assign(this.WindowToGround(pas.GameMath.TPVector.New(AX,AY,0)));
          if (pas.ldactor.Player != null) pas.ldactor.Player.fTarget.$assign(p);
          if (p.Sub(pas.ldactor.Player.fPosition).LengthSqr() <= pas.System.Sqr$1(pas.ldconfig.Config.PlayerReach)) this.PerformAction(pas.GameMath.TPVector.$clone(p));
        };
      } else if ($tmp === 2) this.DialogGUI.DoClick(pas.guibase.TGUIPoint.$clone(pas.guibase.TGUIPoint.Create(AX,AY)),{get: function () {
          return h;
        }, set: function (v) {
          h = v;
        }});
    };
    this.DoMove = function (AX, AY) {
      var h = false;
      var c = null;
      pas.GameBase.TGameBase.DoMove.call(this,AX,AY);
      var $tmp = this.State;
      if ($tmp === 1) {
        this.MainGUI.DoMove(pas.guibase.TGUIPoint.$clone(pas.guibase.TGUIPoint.Create(AX,AY)),{get: function () {
            return h;
          }, set: function (v) {
            h = v;
          }},{get: function () {
            return c;
          }, set: function (v) {
            c = v;
          }})}
       else if ($tmp === 2) this.DialogGUI.DoMove(pas.guibase.TGUIPoint.$clone(pas.guibase.TGUIPoint.Create(AX,AY)),{get: function () {
          return h;
        }, set: function (v) {
          h = v;
        }},{get: function () {
          return c;
        }, set: function (v) {
          c = v;
        }});
    };
    this.InitializeResources = function () {
      pas.GameBase.TGameBase.InitializeResources.call(this);
      pas.resources.TResources.AddImage("assets\/custom.png");
      pas.resources.TResources.AddString("assets\/custom-msdf.json");
      pas.resources.TResources.AddImage("assets\/grass.png");
      pas.resources.TResources.AddImage("assets\/field.png");
      pas.resources.TResources.AddImage("assets\/barley.png");
      pas.resources.TResources.AddImage("assets\/hops.png");
      pas.resources.TResources.AddImage("assets\/Characters\/peasant.png");
      pas.resources.TResources.AddImage("assets\/Characters\/king.png");
      pas.resources.TResources.AddImage("assets\/Characters\/guard.png");
      pas.resources.TResources.AddImage("assets\/Characters\/player.png");
      pas.resources.TResources.AddImage("assets\/well.png");
      pas.resources.TResources.AddImage("assets\/fireplace.png");
      pas.resources.TResources.AddImage("assets\/castle.png");
      pas.resources.TResources.AddImage("assets\/paper.png");
      pas.resources.TResources.AddImage("assets\/Icons\/IconBullet.png");
      pas.resources.TResources.AddImage("assets\/Icons\/IconBucket.png");
      pas.resources.TResources.AddImage("assets\/Icons\/IconBucketFull.png");
      pas.resources.TResources.AddImage("assets\/Icons\/IconHops.png");
      pas.resources.TResources.AddImage("assets\/Icons\/IconBarley.png");
      pas.resources.TResources.AddImage("assets\/Icons\/IconScythe.png");
      pas.resources.TResources.AddImage("assets\/Icons\/IconBeerREG.png");
      pas.resources.TResources.AddImage("assets\/Icons\/IconBeerMED.png");
      pas.resources.TResources.AddImage("assets\/Icons\/IconBeerSTRONG.png");
      pas.resources.TResources.AddImage("assets\/Icons\/IconBeerSuicide.png");
      pas.resources.TResources.AddImage("assets\/bld.png");
      pas.resources.TResources.AddImage("assets\/misc.png");
      pas.resources.TResources.AddString("assets\/tiles.json");
      pas.resources.TResources.AddString("assets\/sprites-icons.json");
      pas.resources.TResources.AddString("assets\/sprites-plants.json");
      pas.resources.TResources.AddString("assets\/sprites-characters.json");
      pas.resources.TResources.AddString("assets\/sprites-buildings.json");
      pas.resources.TResources.AddString("assets\/sprites-misc.json");
      pas.resources.TResources.AddString("assets\/dialog.json");
      pas.resources.TResources.AddString("assets\/config.json");
      pas.resources.TResources.AddString("assets\/map.json");
      this.Tracks[0] = pas.resources.TResources.AddSound("assets\/Audio\/mus_song1.mp3");
      this.Tracks[1] = pas.resources.TResources.AddSound("assets\/Audio\/mus_song2.mp3");
      pas.ldsounds.AddSound("rake",pas.resources.TResources.AddSound("assets\/Audio\/proc_rake.m4a"));
      pas.ldsounds.AddSound("drink",pas.resources.TResources.AddSound("assets\/Audio\/proc_drinkaah.m4a"));
      pas.resources.TResources.AddSound("assets\/Audio\/proc_burp.m4a");
      pas.resources.TResources.AddSound("assets\/Audio\/proc_clunk.m4a");
      pas.ldsounds.AddSound("harvest",pas.resources.TResources.AddSound("assets\/Audio\/proc_harvest.m4a"));
      pas.ldsounds.AddSound("pickup",pas.resources.TResources.AddSound("assets\/Audio\/proc_pickup.m4a"));
      pas.ldsounds.AddSound("drop",pas.resources.TResources.AddSound("assets\/Audio\/proc_plop.m4a"));
      pas.ldsounds.AddSound("kingattack",pas.resources.TResources.AddSound("assets\/Audio\/proc_kingspeech.m4a"));
      pas.ldsounds.AddSound("guardattack",pas.resources.TResources.AddSound("assets\/Audio\/proc_guardattack.m4a"));
      pas.ldsounds.AddSound("playerattack",pas.resources.TResources.AddSound("assets\/Audio\/proc_slap.m4a"));
      pas.ldsounds.AddSound("death",pas.resources.TResources.AddSound("assets\/Audio\/battlecryDeath.m4a"));
      pas.ldsounds.AddSound("death",pas.resources.TResources.AddSound("assets\/Audio\/uuaah.m4a"));
      pas.ldsounds.AddSound("death",pas.resources.TResources.AddSound("assets\/Audio\/wargh.m4a"));
      pas.ldsounds.AddSound("burp",pas.resources.TResources.AddSound("assets\/Audio\/burp.m4a"));
      pas.ldsounds.AddSound("burp",pas.resources.TResources.AddSound("assets\/Audio\/burp2.m4a"));
      pas.ldsounds.AddSound("burp",pas.resources.TResources.AddSound("assets\/Audio\/Ofart.m4a"));
    };
    this.AfterLoad = function () {
      var i = 0;
      pas.GameBase.TGameBase.AfterLoad.call(this);
      pas.ldconfig.LoadConfig(pas.resources.TResources.AddString("assets\/config.json").fString);
      pas.GameSprite.AddSprites(pas.resources.TResources.AddString("assets\/sprites-icons.json").fString);
      pas.GameSprite.AddSprites(pas.resources.TResources.AddString("assets\/sprites-plants.json").fString);
      pas.GameSprite.AddSprites(pas.resources.TResources.AddString("assets\/sprites-characters.json").fString);
      pas.GameSprite.AddSprites(pas.resources.TResources.AddString("assets\/sprites-buildings.json").fString);
      pas.GameSprite.AddSprites(pas.resources.TResources.AddString("assets\/sprites-misc.json").fString);
      this.DialogCfg = JSON.parse(pas.resources.TResources.AddString("assets\/dialog.json").fString);
      pas.ldmap.LoadTiles(pas.resources.TResources.AddString("assets\/tiles.json").fString);
      pas.GameFont.LoadFont("sans",pas.resources.TResources.AddString("assets\/custom-msdf.json").fString,pas.resources.TResources.AddImage("assets\/custom.png"));
      this.AddElement(pas.ECS.EntitySystem);
      this.AddElement(pas.ldmap.Map);
      this.MainGUI = pas.guibase.TGUI.$create("Create$2");
      this.MainGUI.Resize(this.fWidth,this.fHeight);
      this.AddElement(this.MainGUI);
      this.MakeGUI();
      this.MakeDialog();
      for (i = 0; i <= 3; i++) pas.ldmap.SectorArrows[i] = this.AddElement(pas.ldmap.TLDSectorButton.$create("Create$2",[i]));
      this.LoadMap(pas.resources.TResources.AddString("assets\/map.json").fString);
      pas.ldmap.Map.SetCurrentSector(this.StartSector);
    };
    this.AfterResize = function () {
      pas.GameBase.TGameBase.AfterResize.call(this);
      this.Viewport.Projection = pas.GameMath.TPMatrix.$create("Ortho",[this.fWidth / 4,-this.fWidth / 4,this.fHeight / 4,-this.fHeight / 4,-10000,10000]);
      this.Viewport.ModelView = pas.GameMath.TPMatrix.$create("LookAt",[pas.GameMath.TPVector.$clone(pas.GameMath.TPVector.New(450 / 2,450 / 2,0)),pas.GameMath.TPVector.$clone(pas.GameMath.TPVector.New(300,-300,500)),pas.GameMath.TPVector.$clone(pas.GameMath.TPVector.New(0,0,-1))]);
      if (this.MainGUI !== null) {
        this.MainGUI.Resize(this.fWidth,this.fHeight);
        this.MainGuiPanel.SetSize(0,this.fHeight - 200,this.fWidth,200);
      };
      if (this.DialogGUI !== null) {
        this.DialogGUI.Resize(this.fWidth,this.fHeight);
        this.DialogBackH.SetSize(0,0,this.fWidth,this.fHeight);
      };
    };
    this.Create$1 = function () {
      pas.GameBase.TGameBase.Create$1.call(this);
      this.DialogStack = new Array();
      this.IntroElements = new Array($mod.TText.$create("Create$1",[false]));
      return this;
    };
  });
  this.iff = function (a, b) {
    var Result = undefined;
    if (a == undefined) {
      Result = b}
     else Result = a;
    return Result;
  };
  this.GUIHeight = 200;
  this.fTime = 0.0;
  $mod.$main = function () {
    pas.GameBase.RunGame($mod.TLD49Game);
  };
});
//# sourceMappingURL=project1.js.map
