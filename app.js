/***
 * Node.js app to run Office 365 scripts via a web interface
 * is set up to run any executable via a spawned environment
 * uses a configuration JSON object to define the commands/scripts & the UI elements
 *
 * @author Julian Knight, Totally Information, http://www.totallyinformation.com
 * @date 2014-07-16
 ***/
/* IDEAS
    Use Tail = require('tail').Tail to tail an output file - this emits a "line" event whenever a new line is added to the file
*/

// --- JSHint Overides (Linting) http://www.jslint.com/lint.html#options ---------------------------------------------

/*jslint node: true */
/*global next:false, arguments:false */

// http://www.yuiblog.com/blog/2010/12/14/strict-mode-is-coming-to-town/
"use strict";

// --- Variable Definitions ------------------------------------------------------------------------------------------

var express       = require('express'),        // Express web framework for Node
    app           = express(),                 // Create a new express app
    //session       = require('cookie-session'), // provide cookie-based sessions to Express
    //serveIndex    = require('serve-index'),    // Serve up directory listings for Express
    https         = require('https'),          // We want a secure web server ONLY
    fs            = require('fs'),             // Lets us access the filing system
    path          = require('path'),           // Lets us make cross-platform paths
	_	          = require('underscore'),     // Handy utilities missing from JavaScript
	util          = require('util'),
    sys           = require('sys'),
    spawn         = require("child_process").spawn, // Run PS by spawning a child process & listen to stdout
    passport      = require('passport'),        // Std library for Node logins
    LocalStrategy = require('passport-local').Strategy,  // Local data strategy for logins
    //logger        = require('morgan'),          // Express logger
    cookieParser  = require('cookie-parser'),   // Cookie handler
    bodyParser    = require('body-parser'),     // Understand HTML body code from forms
    flash         = require('connect-flash'),   // Helper to store messages in session cookie for transferring between responses
    session       = require('express-session')  // provide sessions to Express https://github.com/expressjs/session
  ;

/***
 * Set up the web and socket servers to use HTTPS
 * We need OpenSSL to create the PEM files (key & cert)
 * These should be in the same folder as this file (or change the path below)
 ***/
var srvOptions = { // SSL Configuration
      key: fs.readFileSync(path.join(__dirname, 'hostkey.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'hostcert.pem'))
    },
    // Define the default HTTPS server port (override with the PORT environment variable if desired)
    port   = (process.env.PORT || 3000),
    // Create https server with options & route any incoming connections to the Express app for processing
	server = https.createServer(srvOptions, app),
    // Create a socket.io server using same server as above
	io     = require('socket.io')(server),
    // Configure the session - applied to Express in the middleware section. Can also be applied to Socket.IO (@see http://stackoverflow.com/a/24859515/1309986)
    // Set up session - used by Passport - https://github.com/expressjs/session
    //app.set('trust proxy', 1); // Required for secure cookies if using a reverse proxy
    sessionMiddleware = session({
        // Set a nonce to hash the cookie contents
        secret:'NodeRunnerSecretSauce1',
        cookie: { 
            // By default cookie.maxAge is null, meaning no "expires" parameter is set so the cookie becomes a browser-session cookie. When the user closes the browser the cookie (and session) will be removed.
            //maxAge: 14400000, // in ms so /1000 to get s. 14400000 = 4hrs
            // Require secure cookies - these MUST use HTTPS and will fail silently otherwise
            secure: true
        }
    }),
    numSockConnects = 0; // count the number of Socket.IO connections
  ;

// Set up some variables to handle generic page output, e.g. page titles

// Start the HTTPS Server using the Express Server fn
server.listen(port, function(){
    //console.log('Listening on port %d', server.address().port);
    sys.log('Listening on port ' + server.address().port );
});

// Shortcut to console.log();
var show = console.log;
// Quick way to dump colourised objects to the console
function pr() {
    _.each(arguments, function(value, key) {
        console.log('%s: ', key);
        console.log(util.inspect(value, {colors:true}));
        console.log('----------');
    });
}
// Dump key parts of a request object to console
function prReq(req){
    pr(req.headers,req.url,req.originalUrl,req._parsedUrl,req.params,req.query);
    pr(req.cookies,req._parsedOriginalUrl,req.route,req.user,req.session,req._passport);
}

// --- Configure User Login Security (using Passport) ----------------------------------------------------------------

var currUser = {}, //used to track the current user
    users = [
        { id: 1, username: 'bob', password: 'secret', email: 'bob@example.com' },
        { id: 2, username: 'joe', password: 'birthday', email: 'joe@example.com' }
    ]
;

function findById(id, fn) {
    var idx = id - 1;
    if (users[idx]) {
        fn(null, users[idx]);
    } else {
        fn(new Error('User ' + id + ' does not exist'));
    }
}

function findByUsername(username, fn) {
    for (var i = 0, len = users.length; i < len; i++) {
        var user = users[i];
        if (user.username === username) {
            return fn(null, user);
        }
    }
    return fn(null, null);
}

// Passport session setup.
// To support persistent login sessions, Passport needs to be able to
// serialize users into and deserialize users out of the session. Typically,
// this will be as simple as storing the user ID when serializing, and finding
// the user by ID when deserializing.
// @todo: add timeouts
passport.serializeUser(function(user, done) {
    done(null, user.id);
});
passport.deserializeUser(function(id, done) {
    findById(id, function (err, user) {
        done(err, user);
    });
});

passport.use('local-login', new LocalStrategy({
        // by default, local strategy uses username and password - included here for completeness
        usernameField : 'username',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, username, password, done) {
        // asynchronous verification, for effect...
        process.nextTick(function () {
            //console.log('Searching for user %s by name', username);
            findByUsername(username, function (err, user) {
                if (username === "") {
                    // NB: 3rd param of done can be an object - this is passed back in the "info" param to the authenticate function if using the callback format
                    return done(null, false, req.flash('loginMessage', 'No user name supplied.') ); 
                }
                if (password === "") {
                    return done(null, false, req.flash('loginMessage', 'No password supplied for username "' + username + '".') ); 
                }

                // die on error
                if (err) { return done(err); }
                // User not found
                if (!user) {
                    return done(null, false, req.flash('loginMessage', 'User "' + username + '" not found.') ); 
                }
                //console.log('Found user %s by name', username);
                // Users password incorrect
                if (user.password != password) { 
                    return done(null, false, req.flash('loginMessage', 'User "' + username + '", password incorrect.') );
                }
                //console.log('Matched user %s password', username);
                return done(null, user, req.flash('loginMessage', 'Successfully logged in as username "' + username + '".'));
            });
        });
    }
));

// --- Express Views Configuration ---------------------------------------------------------------------------------

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// --- Express Pre Routing Middleware ------------------------------------------------------------------------------

/*
// log every error web request to the console (anything >= 400)
app.use(logger('dev', {
  skip: function (req, res) { return res.statusCode < 400; }
}));
*/

app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true }));

// Configure Express Session Middleware
// @see https://github.com/expressjs/cookie-session
/*
app.use(session({
	name: 'NodeRunner',
	keys: ['NodeRunnerSecretSauce1', 'NodeRunnerSecretSauce2'] // array of keys used to sign the cookies, multi allows key rotation
}));
*/
// Configure Express to use session middleware
app.use(sessionMiddleware);

// Initialise Passport for user authentication
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// --- Express Routing Config --------------------------------------------------------------------------------------

/***
 * Check and enforce authentication for specific routes
 ***/
//var auth = false;
var requireAuth = function(req, res, next){
    //return next(); // ****** DISABLE LOGIN FOR TESTING ******* //
    //console.log('Checking authentication');
    if(req.isAuthenticated()) { return next(); }
    //console.log('User not logged in, Redirecting to login');
    // Redirect to login
    res.redirect('/login');
};

// --- Express Routing ---------------------------------------------------------------------------------------------

// Define where our static files exist
app.use(express.static(path.join(__dirname, 'public')));

// a page for telling users what we are about
app.get('/about', function(req, res){
	// For any incoming GET, always return the index.html file in the same folder as this file
    res.render('about', {
        message: req.flash('loginMessage')
    });
});

app.route('/login')
	// show the form (GET http://localhost:8080/login)
	.get(function(req, res) {
         res.render('login', {
            message: req.flash('loginMessage')
        });
	})
	// process the form (POST http://localhost:8080/login)
    // We are using the more complex callback format of authenticate to allow validation of user input
	.post(function(req, res, next) {
        //console.log(req.body);
        if(!req.body.username || !req.body.password){
            req.flash('loginMessage', 'Username and password must be provided.');
            return res.redirect('/login');
        }
        passport.authenticate('local-login', function(err, user, info) {
            //console.log(info);
            if (err) { return next(err); }
            // The strategy failed to find a valid user/password
            // NB: Info is not defined in this instance since we are using session msgs via flash middleware (not adobe flash)
            // So no need to construct a message here, it was already done in the strategy
            if (!user) {
                //req.flash('loginMessage', info.message);
                return res.redirect('/login');
            }
            // Log in
            req.logIn(user, function(err) {
                // If we can't login, die
                if (err) { return next(err); }
                // We've logged in - in this case we redirect to the homepage
                // TODO IS THIS RIGHT? //
                currUser = user;
                //req.flash('loginMessage', info.message);
                return res.redirect('/');
            });
        })(req, res, next);
    });
/*  // for reference, this is the short form of authenticate
	.post(
        passport.authenticate('local-login', { 
            successRedirect: '/', successFlash: 'Logged in as user', 
            failureRedirect: '/login', failureFlash: true 
        }) // if this works, there will be a req.user object
    );
    });
*/
app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/login');
});

/***
 * Require authentication for any subsequent routes
 * @param {string} Path
 * @param {function} Callback that checks user is auth or redirects (use next() in callback to continue the flow)
 ***/
app.all('*', requireAuth);

// A page for output logs
app.get('/logs', function(req, res){
	// For any incoming GET, always return the index.html file in the same folder as this file
    res.render('about', {
        message: 'We come in search of LOG files!' //req.flash('loginMessage')
    });
});

// a page for file output
app.get('/output', function(req, res){
	// For any incoming GET, always return the index.html file in the same folder as this file
    res.render('output', {
        message: req.flash('loginMessage')
    });
	//res.sendfile( path.join(__dirname, 'public/output.html') );
});

/*
=== DANGEROUS ===
// Folder Listing of the folder containing PowerShell scripts
// @todo: Need to change to allow other folders to be listed?
app.use('/ps',serveIndex(path.join(__dirname, 'ps'),
                         {'icons':  true,
                          'filter': function(file,pos,list) { // only return csv files
                              return file.indexOf('csv') >= 1;
                          }
                         }));
// Download files from /ps
// @todo: not very secure!
////////app.use('/ps/ *', function(req,res) {
    console.log(util.inspect(req.params[0]));
    console.log(util.inspect(req.baseUrl));
    res.download(path.join(__dirname, req.baseUrl)); // Set disposition and send it.
});
 */

// Handle the root get which returns the main app page
app.get('/', function(req, res){
	// What was the URL path used?
	//var urlPath = req._parsedUrl.pathname;

	// For any incoming GET, always return the index.html file in the same folder as this file
	//res.sendfile(path.join(__dirname, 'index.html'));
    res.render('index', {
        message: req.flash('loginMessage')
    });

	//console.log(util.inspect(req.originalUrl, {colors:true}));
	//console.log(util.inspect(req._parsedUrl, {colors:true}));
	/*
	baseUrl: '', originalUrl: '/',
	_parsedUrl: {	protocol: null, slashes: null, auth: null, host: null, port: null, hostname: null, hash: null,
					search: null, query: null, pathname: '/', urlPath: '/', href: '/' },
	params: { '0': '' },
	*/
});

// Route GET's for anything in a folder - we exclude certain folders, redirecting to /
// WARNING: Not especially safe as someone could guess the path to a sensitive file
//          Might be useful to add a check for leading _ and ban those too TODO
app.get('/*/*', function(req,res) { ///^\/(\w?)\/\*$/
    var folder = req.params[0];
    //prReq(req); // print key req parameters
    
    // Check if the passed folder is banned
    if(['private','node_modules','views'].indexOf(folder) !== -1) {
        console.log('WARN: Attempt to view file in restricted location!');
        res.redirect('/'); // we don't allow access to those folders
    } else {
        // Not banned - so read the source file and pass it to a page for rendering with syntax highlighting
        var fName = path.join( __dirname, folder, req.params[1] );
        fs.readFile( fName, function(err, data) {
            if (err) {
                // We couldn't read the file for some reason so go back to /
                console.log( 'WARN: Attempt to view file failed: ' + fName );
                res.redirect('/'); // we don't allow access to those folders
            } else {
                res.render('src', {
                    message: '',
                    scriptName: req.params[1],  // Friendly to give the name of the script
                    type: req.query.type,       // We have to pass the type so we can highlight it
                    code: data
                });
            }
        });
    }
});
/*
app.get('/ps/*', function(req,res) {
    console.log(util.inspect(req, {colors:true}));
    res.send(path.join(__dirname, req.baseUrl)); // Set disposition and send it.
});
*/

// No other routes allowed so raise a 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// --- Post Routing Middleware ------------------------------------------------------------------------------------

// Express Middleware to handle errors - this should always be the last middleware
app.use(function(err, req, res){
    res.status(err.status || 500);
    // Route not found (404)
    if (err.status === 404) {
        console.log(util.inspect(req.originalUrl, {colors:true}));
        res.render('error', {
            head1: 'File Not Found',
            menu: menu,
            error: {status: req.originalUrl}, //{} // Change round for production so that stack trace is not reveiled
            message: '<a href="/">Main Page</a>' // allows HTML
        });
    // Any other error
    } else {
        console.error(err.stack);
        res.render('error', {
            head1: err.message,
            menu: menu,
            error: err, //{} // Change round for production so that stack trace is not reveiled
            message: '<a href="/">Main Page</a>' // allows HTML
        });
    }
    //res.send(500, 'An error has occurred. Please try again later.');
});

// --- Runnable Script Configuration ------------------------------------------------------------------------------

// Config is read from a separate module file in the same folder as this
var config = require(path.join(__dirname, 'config.js'));

/***
 * Define the types of script that we allow to be run & how to run them
 ***/
var scriptTypes = config.scriptTypes;

/***
 * Define folder locations & script definitions
 * We don't want the actual script names exposed in the HTML (e.g. to the client) 
 * so we keep them here and reference them from innocuous names in the HTML
 ***/
var locations = config.locations;

/***
 * Getter for translating the selected location to a real folder (returns all record for simplicity & reuse)
 * NB: this is MUCH better than a SELECT CASE statement
 * @returns {object|false} a location object: all data needed to run, handle i/o, etc.
 * @param locn {string} Key to access locations object
 ***/
var getLocation = function(locn) {
	//console.log('getLocation: ', locn);
	if (locations[locn]) {
		return locations[locn];
	} else {
		return false; // 
	}
};
/***
 * Getter for the script type and run definitions
 * @param
 ***/
var getType = function(scriptType){
	//console.log('getLocation: ', locn);
	if (scriptTypes[scriptType]) {
		return scriptTypes[scriptType];
	} else {
		return false; // 
	}    
};

// Output via socket a standard header when a script runs
// Called from stdout/errout on first data recieved event
var setHeader = function(scriptLocn) {
	//console.log(scriptLocn);
    // A nice heading
	io.emit('stdout', '<h1>Output from '+scriptLocn.type+' script '+scriptLocn.script+'</h1>');
    // URL to download the output file - only if one is specified
	if (scriptLocn.outFiles) {
        _.each(scriptLocn.outFiles, function(values, fname){
            io.emit('outputLocn', [fname, values.url]);
        });
    }
    // return false so that the header wont be run again
	return false;
};

// If a selection change event is sent from the browser ...
// Called on initial output (for 1st/default script) & when browser signals a selection change
var selectionChange = function(scriptLocn) {
    // Show the help for the selected script
	if(scriptLocn.help) { io.emit( 'selectChange', [ scriptLocn.help||'', scriptLocn.srcUrl||'', getType(scriptLocn.type).altName||'text' ], currUser ); }
    // If any input parameters specified, send them
    if (scriptLocn.inputs) {
        // 'paramName1':{'type':'text','label':'Enter Parm 1'}
        _.each(scriptLocn.inputs, function(values, paramName){
            io.emit('input', [paramName, values]);
        });
    }
    // If any input files specified, send the details to the client
    if (scriptLocn.inputFiles) {
        _.each(scriptLocn.inputFiles, function(value, fname){
            io.emit('inFile', [fname, value]);
        });
    }
};

// --- Sockets Middleware -----------------------------------------------------------------------------------------

// Configure Sockets to use the same Session Middleware as Express
io.use(function(socket, next){
    sessionMiddleware(socket.request, {}, next);
});

// Socket authorisation
io.use(function(socket, next) {
    var handshakeData = socket.request;
    pr(socket.request.socket.pair.ssl,socket.request.socket.pair.credentials, socket.request.authorised, socket.request.url, socket.request.method,socket.request.isAuthenticated());
    // make sure the handshake data looks good as before
    // if error do this:
        // next(new Error('not authorized');
    // else just call next
    next();
});

// --- Sockets ----------------------------------------------------------------------------------------------------

// Listen for a default socket connection from the browser - @see http://socket.io/docs/migrating-from-0-9/#
io.on('connection', function(socket){
    numSockConnects++; // increment the number of connections
    sys.log('Connection from ID: ' + socket.id + ', # Connects: ' + numSockConnects);
    
    // Currently selected script
    var currSelection = '', // Current Script Name selected in client
        currScript = {}     // Current script definition selected in client (JSON)
    ;    
	
	/***
     * Send the selection options to the client when a client first connects
     * @param key {string} each script keyname,
     * @param value {object} dictionary of entries for that key
     * @param list {object} the  whole input obj
     ***/
    var i = false;
	_.each(locations, function(value, key){
		//console.log('VALUE: ',value,'KEY: ', key);
        // Send all the possible scripts (keys and descriptive titles) to the client as a drop-down selection box
		if (value.clientDescr) { // only send option if clientDescr is defined
			io.emit('options','<option value="' + key + '">' + value.clientDescr + '</option>');
		}
        // Keep track of currently selected script & make sure we have the help & inputs for the default (first) selection on load
        if(!i) { currSelection=key; currScript=value; selectionChange(value); i=true; }
	});
	
	// User changed script select in client so lets send them some help & clear previous output
	socket.on('selectChange', function(msg){
        // Get the configuration data for the script selected & save for reference
        currScript = getLocation(msg);
		// keep track of currently selected script & Output the help and inputs for the new selection to the client
        currSelection = msg;
        selectionChange(currScript);
    });

	// Run the script and update the client when the run button is pressed
    //TODO: sanitise the inputs. Do we need another Auth check here?
	socket.on('go', function(msg){
		console.log(util.inspect(msg, {colors:true}));
		//{name1:value1, name2:value2, selectScript:selectedvalue1 ....}
		
		// Translate the HTML selected script to a real script folder/name & type - much better than a SELECT CASE
		// NOT NEEDED - we keep track of the current location anyway //var scriptLocn = getLocation(msg.selectScript); 
		//console.log(scriptLocn);

        // Get the script run definitions
        var scriptRunner = getType(currScript.type);

        // Remove the script name - everything else is a parameter to pass to the script
        delete msg.selectScript;
        _.each(msg, function(value,paramName){
            // reformat all params into suitable scripts
            // TODO
        });
        
		// Spawn the appropriate script and input - will allow streaming of console output - this prevents the memory from filling up by trying to capture all output before sending to the browser
		var child = spawn( scriptRunner.cmd, [scriptRunner.scriptParam, currScript.script] ); //currScript.type + currScript.typeExt, [currScript.script] );
		child.stdout.setEncoding('utf-8');
		child.stderr.setEncoding('utf-8');

		// Check stdout (console output) events and forward to socket
        // WARNING: no returned data, no client update so make sure that every script outputs SOMETHING
		var stdhead = true;
		child.stdout.on("data",function(data){
			// On first exec, send a heading unless stderr already sent it
			if (stdhead) { stdhead = setHeader(currScript); }
			io.emit('stdout', currScript.outWrap[0] + data + currScript.outWrap[1]);
		});
		
		// Check stderr (console errors) events and forward to socket
		child.stderr.on("data",function(data){
			// On first exec, send a heading unless stdout already sent it
			if (stdhead) { stdhead = setHeader(currScript); }
			io.emit('stdout', '<div class="stderr">'+data+'</div>');
		});

        // Check for exit & close events and forward to socket - NB: THIS NEVER SEEMS TO FIRE
		child.on("exit",function(code){
			io.emit('stdout', '<div class="stdout">---- Script Exited ('+code+') ----</div>');
		});
		child.on("close",function(code){
			io.emit('stdout', '<div class="stdout">---- Script Closed ('+code+') ----</div>');
		});
	}); // ---- End of 'go' socket event handler ---- //
	
    // Do something when a file is uploaded - NB: original file names are ignored for safety. File is written only to the spec defined in config
    socket.on("file upload", function(msg){
        // msg = {fileData, fileIndex}
        
        // Save the file in the location specified by the script definition and of the type specified (prevents security issues)
        // inputFiles: [ {'fname.ext': path.join(__dirname, 'ps', 'fname.ext')} ]
        fs.writeFile( currScript.inputFiles[msg.fileIndex] , msg.fileData, function (err) {
            if (err) {
                console.log('ERROR:Cannot write file to server: ' + err);
                //throw err;
                io.emit('chat message', 'ERROR:Cannot write file to server: ' + err);
            }
        });
    });

    // Log when a client disconnects
	socket.on('disconnect', function(){
        // decrement the number of connections
        numSockConnects--;
        sys.log('Disconnection from ID: ' + socket.id + ', # Connects: ' + numSockConnects);
		//console.log('user disconnected');
	});

    // If a client issues a chat message, reflect it to the console and to all other clients (not really needed)
	socket.on('chat message', function(msg){
		io.emit('chat message', msg);
		console.log('message: ' + msg);
	});

    // EXPERIMENTAL: Watch the fs for changes
    fs.watch(__dirname + '/ps', function(event, filename) {
        console.log("Event:", event, ', Filename: ', filename);

        /*
        if (event == "change") {
            fs.readFile("arquivo.txt","UTF-8", function(err, data) {
                if (err) {throw err; }
                socket.emit("receiveFile", data );
                console.log("Content:", data);
            });
        }
        */

    });

});
