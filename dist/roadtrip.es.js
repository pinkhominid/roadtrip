var a = typeof document !== 'undefined' && document.createElement( 'a' );
var QUERYPAIR_REGEX = /^([\w\-]+)(?:=([^&]*))?$/;
var HANDLERS = [ 'beforeenter', 'enter', 'leave', 'update' ];

var isInitial = true;

function RouteData (ref) {
	var route = ref.route;
	var pathname = ref.pathname;
	var params = ref.params;
	var query = ref.query;
	var hash = ref.hash;
	var scrollX = ref.scrollX;
	var scrollY = ref.scrollY;

	this.pathname = pathname;
	this.params = params;
	this.query = query;
	this.hash = hash;
	this.isInitial = isInitial;
	this.scrollX = scrollX;
	this.scrollY = scrollY;

	this._route = route;

	isInitial = false;
}

RouteData.prototype = {
	matches: function matches ( href ) {
		return this._route.matches( href );
	}
};

function Route ( path, options ) {
	var this$1 = this;

	// strip leading slash
	if ( path[0] === '/' ) {
		path = path.slice( 1 );
	}

	this.path = path;
	this.segments = path.split( '/' );

	if ( typeof options === 'function' ) {
		options = {
			enter: options
		};
	}

	this.updateable = typeof options.update === 'function';

	HANDLERS.forEach( function (handler) {
		this$1[ handler ] = function ( route, other ) {
			var value;

			if ( options[ handler ] ) {
				value = options[ handler ]( route, other );
			}

			return roadtrip.Promise.resolve( value );
		};
	});
}

Route.prototype = {
	matches: function matches$1 ( href ) {
		a.href = href;

		var pathname = a.pathname.indexOf( '/' ) === 0 ?
			a.pathname.slice( 1 ) :
			a.pathname;
		var segments = pathname.split( '/' );

		return segmentsMatch( segments, this.segments );
	},

	exec: function exec ( target ) {
		var this$1 = this;

		a.href = target.href;

		var pathname = a.pathname.indexOf( '/' ) === 0 ?
			a.pathname.slice( 1 ) :
			a.pathname;
		var search = a.search.slice( 1 );

		var segments = pathname.split( '/' );

		if ( !segmentsMatch( segments, this.segments ) ) {
			return false;
		}

		var params = {};

		for ( var i = 0; i < segments.length; i += 1 ) {
			var segment = segments[i];
			var toMatch = this$1.segments[i];

			if ( toMatch[0] === ':' ) {
				params[ toMatch.slice( 1 ) ] = segment;
			}

			else if ( toMatch === '*' ) {
				params[ toMatch ] = segments.slice(i);
				break;
			}
		}

		var query = {};
		var queryPairs = search.split( '&' );

		for ( var i$1 = 0; i$1 < queryPairs.length; i$1 += 1 ) {
			var match = QUERYPAIR_REGEX.exec( queryPairs[i$1] );

			if ( match ) {
				var key = match[1];
				var value = decodeURIComponent( match[2] );

				if ( query.hasOwnProperty( key ) ) {
					if ( typeof query[ key ] !== 'object' ) {
						query[ key ] = [ query[ key ] ];
					}

					query[ key ].push( value );
				}

				else {
					query[ key ] = value;
				}
			}
		}

		return new RouteData({
			route: this,
			pathname: pathname,
			params: params,
			query: query,
			hash: a.hash.slice( 1 ),
			scrollX: target.scrollX,
			scrollY: target.scrollY
		});
	}
};

function segmentsMatch ( a, b ) {
	if ( b[ b.length-1 ] === '*' ) {
		return segmentsMatch( a.slice( 0, b.length-1 ), b.slice( 0, b.length-1 ) );
	}

	if ( a.length !== b.length ) { return; }

	var i = a.length;
	while ( i-- ) {
		if ( ( a[i] !== b[i] ) && ( b[i][0] !== ':' ) ) {
			return false;
		}
	}

	return true;
}

var window$1 = ( typeof window !== 'undefined' ? window : null );

var routes = [];

// Adapted from https://github.com/visionmedia/page.js
// MIT license https://github.com/visionmedia/page.js#license

function watchLinks ( callback ) {
	window$1.addEventListener( 'click', handler, false );
	window$1.addEventListener( 'touchstart', handler, false );

	function handler ( event ) {
		if ( which( event ) !== 1 ) { return; }
		if ( event.metaKey || event.ctrlKey || event.shiftKey ) { return; }
		if ( event.defaultPrevented ) { return; }

		// ensure target is a link
		var el = event.target;

		// el.nodeName for svg links are 'a' instead of 'A'
		while ( el && el.nodeName.toUpperCase() !== 'A' ) {
			el = el.parentNode;
		}

		if ( !el || el.nodeName.toUpperCase() !== 'A' ) { return; }

		// check if link is inside an svg
		// in this case, both href and target are always inside an object
		var svg = ( typeof el.href === 'object' ) && el.href.constructor.name === 'SVGAnimatedString';

		// Ignore if tag has
		// 1. 'download' attribute
		// 2. rel='external' attribute
		if ( el.hasAttribute( 'download' ) || el.getAttribute( 'rel' ) === 'external' ) { return; }

		// ensure non-hash for the same path

		// Check for mailto: in the href
		if ( ~el.href.indexOf( 'mailto:' ) ) { return; }

		// check target
		// svg target is an object and its desired value is in .baseVal property
		if ( svg ? el.target.baseVal : el.target ) { return; }

		// x-origin
		// note: svg links that are not relative don't call click events (and skip watchLinks)
		// consequently, all svg links tested inside watchLinks are relative and in the same origin
		if ( !svg && !sameOrigin( el.href ) ) { return; }

		// rebuild path
		// There aren't .pathname and .search properties in svg links, so we use href
		// Also, svg href is an object and its desired value is in .baseVal property
		var path = svg ? el.href.baseVal : ( el.pathname + el.search + ( el.hash || '' ) );

		// strip leading '/[drive letter]:' on NW.js on Windows
		if ( typeof process !== 'undefined' && path.match( /^\/[a-zA-Z]:\// ) ) {
			path = path.replace( /^\/[a-zA-Z]:\//, '/' );
		}

		// same page
		var orig = path;

		if ( path.indexOf( roadtrip.base ) === 0 ) {
			path = path.substr( roadtrip.base.length );
		}

		if ( roadtrip.base && orig === path ) { return; }

		// no match? allow navigation
		if ( !routes.some( function (route) { return route.matches( orig ); } ) ) { return; }

		event.preventDefault();
		callback( orig );
	}
}

function which ( event ) {
	event = event || window$1.event;
	return event.which === null ? event.button : event.which;
}

function sameOrigin ( href ) {
	var origin = location.protocol + '//' + location.hostname;
	if ( location.port ) { origin += ':' + location.port; }

	return ( href && ( href.indexOf( origin ) === 0 ) );
}

function isSameRoute ( routeA, routeB, dataA, dataB ) {
	if ( routeA !== routeB ) {
		return false;
	}

	return (
		dataA.hash === dataB.hash &&
		deepEqual( dataA.params, dataB.params ) &&
		deepEqual( dataA.query, dataB.query )
	);
}

function deepEqual ( a, b ) {
	if ( a === null && b === null ) {
		return true;
	}

	if ( isArray( a ) && isArray( b ) ) {
		var i = a.length;

		if ( b.length !== i ) { return false; }

		while ( i-- ) {
			if ( !deepEqual( a[i], b[i] ) ) {
				return false;
			}
		}

		return true;
	}

	else if ( typeof a === 'object' && typeof b === 'object' ) {
		var aKeys = Object.keys( a );
		var bKeys = Object.keys( b );

		var i$1 = aKeys.length;

		if ( bKeys.length !== i$1 ) { return false; }

		while ( i$1-- ) {
			var key = aKeys[i$1];

			if ( !b.hasOwnProperty( key ) || !deepEqual( b[ key ], a[ key ] ) ) {
				return false;
			}
		}

		return true;
	}

	return a === b;
}

var toString = Object.prototype.toString;

function isArray ( thing ) {
	return toString.call( thing ) === '[object Array]';
}

// Enables HTML5-History-API polyfill: https://github.com/devote/HTML5-History-API
var location$1 = window$1 && ( window$1.history.location || window$1.location );

function noop () {}

var currentData = {};
var currentRoute = {
	enter: function () { return roadtrip.Promise.resolve(); },
	leave: function () { return roadtrip.Promise.resolve(); }
};

var _target;
var isTransitioning = false;

var scrollHistory = {};
var uniqueID = 1;
var currentID = uniqueID;

var roadtrip = {
	base: '',
	Promise: Promise,

	add: function add ( path, options ) {
		routes.push( new Route( path, options ) );
		return roadtrip;
	},

	start: function start ( options ) {
		if ( options === void 0 ) options = {};

		if ( options.renamePopstateEvent ) {
			renamePopstateEvent( options.renamePopstateEvent );
		}
		
		var href = routes.some( function (route) { return route.matches( location$1.href ); } ) ?
			location$1.href :
			options.fallback;

		return roadtrip.goto( href, {
			replaceState: true,
			scrollX: window$1.scrollX,
			scrollY: window$1.scrollY
		});
	},

	goto: function goto ( href, options ) {
		if ( options === void 0 ) options = {};

		scrollHistory[ currentID ] = {
			x: window$1.scrollX,
			y: window$1.scrollY
		};

		var target;
		var promise = new roadtrip.Promise( function ( fulfil, reject ) {
			target = _target = {
				href: href,
				scrollX: options.scrollX || 0,
				scrollY: options.scrollY || 0,
				options: options,
				fulfil: fulfil,
				reject: reject
			};
		});

		_target.promise = promise;

		if ( isTransitioning ) {
			return promise;
		}

		_goto( target );
		return promise;
	},
	getCurrentID: function getCurrentID () {
		return currentID;
	}
};

if ( window$1 ) {
	watchLinks( function (href) { return roadtrip.goto( href ); } );
	// watch history
	window$1.addEventListener( 'popstate', popstateHandler, false );
}

function popstateHandler (event) {
	event = event.detail || event;
	
	if ( !event.state) { return; } // hashchange, or otherwise outside roadtrip's control
	var scroll = scrollHistory[ event.state.uid ];

	_target = {
		href: location$1.href,
		scrollX: (scroll ? scroll.x : 0),
		scrollY: (scroll ? scroll.y : 0),
		popstate: true, // so we know not to manipulate the history
		fulfil: noop,
		reject: noop
	};

	_goto( _target );
	currentID = event.state.uid;
}

function renamePopstateEvent ( eventName ) {
	window$1.removeEventListener('popstate', popstateHandler, false);
	window$1.addEventListener( eventName, popstateHandler, false );
}

function _goto ( target ) {
	var newRoute;
	var newData;

	for ( var i = 0; i < routes.length; i += 1 ) {
		var route = routes[i];
		newData = route.exec( target );

		if ( newData ) {
			newRoute = route;
			break;
		}
	}

	if ( !newRoute || isSameRoute( newRoute, currentRoute, newData, currentData ) ) {
		target.fulfil();
		return;
	}

	scrollHistory[ currentID ] = {
		x: ( currentData.scrollX = window$1.scrollX ),
		y: ( currentData.scrollY = window$1.scrollY )
	};

	isTransitioning = true;

	var promise;

	if ( ( newRoute === currentRoute ) && newRoute.updateable ) {
		promise = newRoute.update( newData );
	} else {
		promise = roadtrip.Promise.all([
			currentRoute.leave( currentData, newData ),
			newRoute.beforeenter( newData, currentData )
		]).then( function () { return newRoute.enter( newData, currentData ); } );
	}

	promise
		.then( function () {
			currentRoute = newRoute;
			currentData = newData;

			isTransitioning = false;

			// if the user navigated while the transition was taking
			// place, we need to do it all again
			if ( _target !== target ) {
				_goto( _target );
				_target.promise.then( target.fulfil, target.reject );
			} else {
				target.fulfil();
			}
		})
		.catch( target.reject );

	if ( target.popstate ) { return; }

	var ref = target.options;
	var replaceState = ref.replaceState;
	var invisible = ref.invisible;
	if ( invisible ) { return; }

	var uid = replaceState ? currentID : ++uniqueID;
	history[ replaceState ? 'replaceState' : 'pushState' ]( { uid: uid }, '', target.href );

	currentID = uid;
	scrollHistory[ currentID ] = {
		x: target.scrollX,
		y: target.scrollY
	};
}

export default roadtrip;
