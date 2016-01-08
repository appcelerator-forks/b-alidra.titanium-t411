var config 		= require('t411/config');

var t411 = function(user, password) {
	this.base_uri	= "https://api.t411.in";
    this.timeout 	= 5000;
    
	this.username	= user || config.user;
	this.password	= password || config.password;
	this.token		= Ti.App.Properties.getString('t411_token');
	this.token_date	= Ti.App.Properties.getString('t411_token_date');
};

t411.prototype.checkToken = function() {
	this.token		= Ti.App.Properties.getString('t411_token');
	this.token_date	= Ti.App.Properties.getString('t411_token_date');
	
	var res =  
		!_.isEmpty(this.token) &&
		!_.isEmpty(this.token_date) &&
		((_.now() / 1000 - this.token_date) < 90*24*60*60);
	
	return res;
};

t411.prototype.requestToken = function(callback) {
	var self = this;
	this.query({
		method: "POST",
		query:   "/auth",
		body: {
			username: this.username,
			password: this.password
		}
	}, function (err, response) {
		if (err)
			callback && callback(err);
		else {
			self.token = response.token;
			self.token_date = _.now() / 1000;
			Ti.App.Properties.setString('t411_token', self.token);
			Ti.App.Properties.setString('t411_token_date', self.token_date);
			
			callback && callback(null, response);
		}
	});
};

t411.prototype.search = function(options, callback) {
	var term		= options.term || "";
	var category	= options.category || "";
	var query = "/torrents/search/" +  Ti.Network.encodeURIComponent(term) + '?limit=100&order=seeders&type=desc';
	if (!_.isEmpty(category))
		query += "&cid=" + category;
		
	this.query({ query: query }, callback);	
};

t411.prototype.download = function(torrent_id, callback) {
	this.query({
		query: "/torrents/download/" + torrent_id,
		raw: true
	}, callback);
};

t411.prototype.downloadUrl = function(torrent_id) {
	return this.base_uri + "/torrents/download/" + torrent_id;
};

t411.prototype.query = function(options, callback) {
	'use strict';
	if (!Ti.Network.online) {
		callback && (callback({"error": "No connection"}));
		return;
	}

	if (options.query != '/auth' && !this.checkToken()) {
		Ti.API.info('Getting new token');
		var self = this;
		this.requestToken(function(err, response) {
			if (err)
				callback && callback(err);
			else
				self.query(options, callback);
		});
		
		return false;
	}
	
    var method, status, xhr, raw;

    method	= options.method || "GET";
    status	= options.status || 200;
    raw		= options.raw	 || false;
    
    xhr 	= Titanium.Network.createHTTPClient();

    xhr.ontimeout = function () {
        error('{"status_code":408,"status_message":"Request timed out"}');
    };

    xhr.open(method, this.base_uri + options.query, true);

    if (options.query != '/auth' && !_.isEmpty(this.token))
    	xhr.setRequestHeader('Authorization', this.token);
    
    xhr.timeout = this.timeout;

    xhr.onload = function (e) {
        if (xhr.readyState === 4) {
            if (xhr.status === status) {
            	var response = !raw ? JSON.parse(xhr.responseText) : xhr.responseText;
            	if (response.error)
            		callback && callback(response);
            	else
                	callback && callback(null, response);
            } else {
                callback && callback(xhr.responseText);
            }
        } else {
            callback && callback(xhr.responseText);
        }
    };

    xhr.onerror = function (e) {
        callback && callback(xhr.responseText);
    };
    
    if (options.method === "POST") {
        xhr.send(options.body);
    } else {
        xhr.send();
    }
};

if ((typeof module != 'undefined') && (module.exports)) {
	module.exports = t411;	
}
