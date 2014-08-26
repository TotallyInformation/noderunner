NodeRunner v0.2.1
=================

Node OS Command Runner - run native OS commands via a web service.

### Features
- Run most native OS commands via a web interface
- Pass parameters:
   - Statically configured
   - via user input (web interface)
   - via input files (loaded via the web interface)
- Download output files
- Recieve terminal output to the web interface
- Syntx highlighted source code viewer included
- Some example test scripts included (see the ts folder)

### Limitations
The system has been created to meet a specific need. I've tried to make it as flexible as possible but it undoubtedly needs some additional work.

- As configured, the tool uses HTTPS security. This is highly recommended *but* you need to create your own ```hostcert.pem``` and ```hostkey.pem``` files in the root folder.
  ```OpenSSL``` is used for this and it is available on most platforms.
  To create a simple, self-signed certificate, valid for 10 years. Run the following OpenSSL command:
          openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout hostkey.pem -out hostcert.pem
  To get a 'proper' certificate, signed by a trust authority, you need to run something like:
          openssl req -newkey rsa:2048 -new -nodes -keyout hostkey.pem -out csr.pem
  and then to send the csr.pem to your certificate provider who will return the ```hostcert```.
  See the [Node.JS TLS documentation](http://nodejs.org/api/tls.html) for more details.
- As configured, security is limited (manually configured id/password login via Passport).
  - Use Passport extensions to add your own scheme.
  - Need to pen-test the whole system
  - Need additional testing of Socket.IO to understand any security weaknesses - e.g. can socket messages be spoofed?
- Security around the source code viewer is minimal. Key folders are excluded but anyone with knowledge might be able to view code by manipulating the URL.
  - Disable the routing for "```/*/*```" if source security is important.
  - Alternatively, put secure scripts in their own folder and add that to the banned folders.

However, even with these limitations, the system is highly usable in a controlled environment. Just ensure that the platform it is running on is reasonably secured.

### Installation
To install, simply use NPM from the GitHub published version.

        --cmd to be included here--
        
Or, when published to NPM, install as:

        --cmd to be included here--
        
### Configuration
This system will not work without configuration.

1. HTTPS - Create the ```hostcert.pem``` and ```hostkey.pem``` files as shown in the Limitations section above
2. Place any scripts or commands you want to be able to run in appropriate folders under the root folder
3. Copy the ```config-sample.js``` file to ```config.js``` and amend to include the scripts you need
4. If required, change the default port (see ```app.js```)
5. Start the system manually with ```npm start```
6. Test the system to make sure it does what you want it to and further adjust the ```config.js``` file as needed
7. Run the system under a tool such as [supervisor](https://github.com/isaacs/node-supervisor) to ensure that it stays running.

### License
This system is MIT Licensed. Please read the license file [MIT-License.htm](MIT-License.htm)

### To Do
- Fix page resets
	- Need to have a common function on client as well as server
- Inputs
	- Capture all of input form as JSON and return to server via IO
	- Add file Uploads
- Make some stuff private
	- Id/passwords, basics are done, needs more work
    - Add more flexible contact info - not hard coded
- Combine readme.md into the about page (file read & [marked](https://www.npmjs.org/package/marked)).

