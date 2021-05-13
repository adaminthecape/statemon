let statemon = {
	/* Statemon */ _version: '1.94', /* Monitor the Vue state on live sites and localhost */
	notes: {
		// Instructions: Open Chrome, then Devtools (f12). Go to Sources, then Snippets.
		// Add a snippet, name it, paste this script & run it (ctrl+Enter)
		// Click a button to start ('monitor' to start monitoring)
		// Check out statemon.options{} for UI options.
		// ----
		// Example output:
		// => 0 app,loading ::  false --> true
		// => 1 admin,editMode ::  false --> true
		// => 0 admin,editMode ::  true --> false
		// meaning:
		// 2 changes detected in the last tick,
		// change[0]: app.loading changed from false to true
		// change[1]: admin.editMode changed from false to true
		// then editMode was toggled off in the next tick.
		// ----
		// I know there's no const in here. It's Chrome's fault.
		// ----
		// v1.1: vastly improved memory usage and garbage collection.
		// v1.2: added browser log output instead of console (toggle in options).
		//       output is faster with the browser & has less interference.
		// v1.4: made the browser output much prettier.
		// v1.5: find the state without being given a div name
		// v1.6: added RAM overflow handling & better garbage collection.
		// v1.7: added feature: search the state & filter by path/tag
		// v1.8: improved search: added filters
		// - example: app,settings, -> only return results within "app/settings/*"
		// v1.9: style improvements, buttons take up less space
		// v1.91: changed versioning to avoid hitting 2.0 too early
		// v1.92: containerized statemon into window.statemon object, made ES6 compliant
		// v1.94: improved css
		// ----
		// TODO (please help if you are able):
		// search without requiring a keyword (with * for wildcard)
		// allow case match in search
		// affix statemon-container to the document so that it scrolls with the page
		// RAM usage climbs by about 2MB per second. What is doing this?
	},
	/* Initialize variables: */
	options: {
		isAluminati: true, // set true if you want to filter the keys using keysBase[]
		colors: {
			background: {
				colorFalse: '#aa000080', colorTrue: '#00aa0080'
			}
		},
		searchResultsLimit: 200, // limit the search results. you don't want to add 4000 new divs
		printSearchResultsToConsoleAsWell: false, // no comment
		intervalMillis: 500, // monitor() will check every x millis (higher = performance, lower = accuracy)
		logTarget: 'browser', // browser or console
		changed: {
			// e.g. 'item' [message] [from] oldVal [to] newVal
			message: '::',
			from: '',
			to: '-->'
		},
		added: {
			// e.g. 'item' [message] newVal
			message: 'added:'
		},
		silence: [
			// add keys here you don't want to hear about
			'app,loading', 'entities,loading'
			// 'app,activeModuleId','app,activePageId'
		],
		keysBase: [
			// comment out whatever you don't want to monitor (greatly improves performance)
			'app', 'statistics', 'user', 'profiles', 'userLists',
			'admin', 'dataSchemas', 'entities', 'powerUps',
			'applications', 'entityDefinitions', 'communications', 'emailTemplates',
			'chats', 'dataMappings', 'handlebars'
		],
		keysBase0: [
			// all the top level keys you'd expect to find in the state (as of May 2021)
			'audit', 'app', 'statistics', 'user', 'profileFormCopy', 'profiles', 'userLists',
			'admin', 'i18n', 'files', 'fileLists', 'dataSchemas', 'entities', 'powerUps',
			'applications', 'entityDefinitions', 'communications', 'emailTemplates',
			'external', 'chats', 'reportAbuse', 'dataMappings', 'handlebars'
		]
	},
	togglers: {
		// booleans for toggling
		monitoring: false,
		monitoringBusy: false, // to prevent concurrent looping
		showAdded: false, // show NEW items in the state (set to true if you like clutter)
		hasErrors: false, // flag if errors found
		boxOpen: true, // changeBox open/closed
		searchBoxOpen: false // searchBox open/closed
	},
	cacheNew: {}, // created on first loop of monitorFn
	cacheOld: {}, // doesn't exist until second loop of monitorFn
	app: null, // div#app
	store: null, // app.__vue__.$store
	state: null, // store.state
	changeArray: [], // changes get pushed here
	container: null, // container for the buttons
	changeBox: null, // text box into which to output changes
	searchBox: null, // box to search the state
	dumpVal: null, // pointer for addToDump
	buttonOffsetTop: 50, // so the buttons aren't on top of each other
	toggler: null, // for toggling buttons
	browserLogTxt: '', // to output to the browser
	stateCache: {}, // getStateData() cache
	stateKeys: [], // getStateData() keys
	oldValTemp: null, // temp variable for comparisons
	newValTemp: null, // temp variable for comparisons
	searchActive: false, // flag for search function
	searchKeyword: '',
	searchResults: [], // array to store search results
	searchFilters: [], // to filter results by source
	searchFiltersString: '', // from which to create searchFilters[]
	clickers: null,
	statefulDivs: [],
	monitorInterval: null, // monitoring loop
	ramInterval: null, // ram usage indicator loop
	currentRamUsageAmount: 0,
	styles: null, // css
	ramBox: null, // ram usage indicator
	errorMsg: '', // error message
	elTemp: null, // temporary holder for elements
	statefulArr1: null,
	statefulArr2: null,

	init()
	{
		// remove statemon stuff if on first run
		statemon.elTemp = document.getElementById('statemon-container');

		if(statemon.elTemp) statemon.elTemp.remove();

		// destroy interval if present (like when reloading the script)
		clearInterval(statemon.monitorInterval);

		// check that the state exists (not much point running if it doesn't)
		statemon.statefulDivs = statemon.findStatefulDivs();
		if(statemon.statefulDivs.length > 0)
		{
			// get app, store, state
			statemon.app = statemon.statefulDivs[0];
			statemon.store = statemon.app?.__vue__.$store || null;
			statemon.state = statemon.store?.state || null;
			statemon.addTheStyles(); // make the buttons bearable
			statemon.addButtonContainer(); // does what it says
			statemon.createClickers();
			statemon.createButton('status', null, 'status');
			statemon.createButton('snapshot', statemon.getSnapshot, 'snapshot');
			statemon.createButton('toggleMonitoring', statemon.toggleMonitoring, 'monitor');
			statemon.createButton('toggleChanges', statemon.toggleChangeBox, 'hide changes');
			statemon.createButton('toggleHideAdded', statemon.toggleHideAdded, 'show additions');
			statemon.createButton('toggleSearchBox', statemon.toggleSearchBox, 'search');
			statemon.createSearchBox();
			statemon.createChangeBox();
			document.addEventListener('keydown', statemon.hideChangesOnKey);
		}
		else
		{
			statemon.togglers.hasErrors = true;
			console.log('Vue state not detected!');
		}

		statemon.errorMsg = statemon.togglers.hasErrors ? 'Errors were found' : 'Ready to start';

		return `Statemon v${statemon._version} **Monitor/search the Vue state** ${statemon.errorMsg}...`;
	},
	/* Styles and logic for the ui: */
	hideChangesOnKey(e)
	{
		// hide the changeBox when a key is pressed
		if(e.keyCode === 17) // ctrl = 17
		{
			statemon.toggleChangeBox();
		}
	},
	addTheStyles()
	{
		// add some nice styling for the buttons

		// remove existing styles
		statemon.elTemp = document.getElementById('statemon-style');

		if(statemon.elTemp) statemon.elTemp.remove();

		statemon.styles = document.createElement('style');
		if(statemon.styles)
		{
			statemon.styles.id = 'statemon-style';
			statemon.styles.innerHTML = `
                /* form styles */
                #statemon-search-form-container { display: flex; }
                #statemon-search-input { flex-grow: 1; width: 85%; }
                #statemon-search-filter { flex-grow: 1; width: 85%; }
                #statemon-search-go { width: 10%; }
                
                #statemon-container { /* main container */
                    position: absolute;
                    top: 10vh;
                    right: 0;
                    z-index: 10000;
                    width: 50%;
                    min-width: 500px;
                    max-width: 1000px;
                    height: 90vh;
                    display: flex;
                    flex-direction: column;
                }
                .statemon-changeBox {
                    flex-grow: 4;
                    width: auto;
                    width: 100%;
                    overflow-y: scroll;
                    color: green;
                    padding: 8px;
                    margin-top: 8px;
                    display: none;
                    flex-direction: column;
                    background: #bbbbbbf0;
                }
                .statemon-searchBox {
                    flex-grow: 4;
                    overflow-x: hidden;
                    width: 100%;
                    overflow-y: scroll;
                    color: green;
                    padding: 8px;
                    margin-top: 8px;
                    display: none;
                    flex-direction: column-reverse;
                    background: #bbbbbbf0;
                }
                .statemon-changeBox > div { flex-grow: 1; }
                .scb-changed { color: green; border-bottom: 1px solid black; }
                .scb-added { color: blue; border-bottom: 1px solid black; }
                .scb-changed:hover { color: green; background: white; }
                .scb-item { color: black; }
                .scb-oldVal { color: maroon; }
                .scb-newVal { color: green; }
                .statemon-link-container {
                    cursor: pointer;
                    width: auto;
                    height: auto;
                    background: #bbbbbba0;
                    padding: 5px;
                    z-index: 1000000000;
                    text-align: center;
                    display: flex;
                    flex-direction: row;
                    flex-wrap: auto;
                    justify-content: flex-start;
                }
                .statemon-link-container > button {
                    color: blue;
                    flex-grow: 1;
                    padding: 8px;
                    margin: 2px;
                    border: 1px solid green;
                    border-radius: 6px;
                    cursor: pointer;
                    width: auto;
                    height: auto;
                }
                .statemon-link-container > button:hover {
                    box-shadow: 0px 0px 0px 12px rgba(0,0,0,0.1);
                }
            `;

			document.head.appendChild(statemon.styles);
		}
	},
	addButtonContainer()
	{
		statemon.elTemp = document.createElement('div');
		statemon.elTemp.id = 'statemon-container';
		statemon.elTemp.className += ' z-top ';
		document.body.appendChild(statemon.elTemp); // todo: make this scroll with the page
		statemon.container = document.getElementById('statemon-container');
	},
	createButton(id, onclick, label)
	{
		// remove existing buttons
		statemon.elTemp = document.getElementById(`statemon-button-${id}`);

		if(statemon.elTemp) statemon.elTemp.remove();

		// create the button
		statemon.elTemp = document.createElement('button');

		if(statemon.elTemp && statemon.container)
		{
			statemon.elTemp.id = `statemon-button-${id}`;
			statemon.elTemp.innerText += label;
			statemon.elTemp.className += 'statemon-button';
			statemon.elTemp.addEventListener('click', onclick);
			statemon.clickers.appendChild(statemon.elTemp);
			// statemon.buttonOffsetTop += 50;
		}
	},
	createClickers()
	{
		// remove existing box
		statemon.elTemp = document.getElementById('statemon-clickers');

		if(statemon.elTemp) statemon.elTemp.remove();

		// create the box
		statemon.clickers = document.createElement('div');
		if(statemon.clickers)
		{
			statemon.clickers.id = 'statemon-clickers';
			statemon.clickers.className += 'statemon-link-container statemon-clickers';
			statemon.clickers.style.top = '100px';
			statemon.container.appendChild(statemon.clickers);
			statemon.clickers = document.getElementById('statemon-clickers');
		}
	},
	createChangeBox()
	{
		// remove existing box
		statemon.elTemp = document.getElementById('statemon-changeBox');

		if(statemon.elTemp) statemon.elTemp.remove();

		// create the box
		statemon.changeBox = document.createElement('div');
		if(statemon.changeBox)
		{
			statemon.changeBox.id = 'statemon-changeBox';
			statemon.changeBox.className += 'statemon-changeBox';
			// statemon.changeBox.style.top = `${301 + statemon.buttonOffsetTop}px`;
			statemon.container.appendChild(statemon.changeBox);
			// statemon.buttonOffsetTop += 500;
			statemon.changeBox = document.getElementById('statemon-changeBox');
		}
	},
	createSearchBox()
	{
		// remove existing box
		statemon.elTemp = document.getElementById('statemon-searchBox');

		if(statemon.elTemp) statemon.elTemp.remove();

		// create the box
		statemon.searchBox = document.createElement('div');
		if(statemon.searchBox && statemon.container)
		{
			statemon.searchBox.id = 'statemon-searchBox';
			statemon.searchBox.className += 'statemon-searchBox';
			// statemon.searchBox.style.top = `${200 + statemon.buttonOffsetTop}px`;
			statemon.container.appendChild(statemon.searchBox);
			// statemon.buttonOffsetTop += 200;
			statemon.searchBox = document.getElementById('statemon-searchBox');

			statemon.searchBox.innerHTML += `
    <div id="statemon-search-input-container">
        <input type="text" placeholder="Search the state..." id="statemon-search-input" value="${statemon.searchKeyword}" />
        <input type="text" placeholder="Filter by tag (delimiter: ;)" id="statemon-search-filter" value="${statemon.searchFiltersString}" />
        <button onClick="statemon.searchCache()" id="statemon-search-go">Go</button>
    </div>
            `;
		}
	},
	toggleChangeBox()
	{
		// show/hide the change box (browser output)
		if(statemon.changeBox)
		{
			statemon.changeBox.style.display = statemon.togglers.boxOpen ? 'none' : 'flex';
			statemon.elTemp = document.getElementById('statemon-button-toggleChanges');
			if(statemon.elTemp)
			{
				statemon.elTemp.style.color = statemon.togglers.boxOpen ? statemon.options.colors.background.colorTrue : statemon.options.colors.background.colorFalse;
				statemon.elTemp.innerText = statemon.togglers.boxOpen ? 'show changes' : 'hide changes';
			}
		}

		statemon.togglers.boxOpen = !statemon.togglers.boxOpen;
	},
	toggleSearchBox()
	{
		statemon.elTemp = document.getElementById('statemon-button-toggleSearchBox');
		if(statemon.elTemp)
		{
			statemon.elTemp.style.color = statemon.togglers.searchBoxOpen ? statemon.options.colors.background.colorTrue : statemon.options.colors.background.colorFalse;
		}

		// show/hide the search box (browser output)
		if(statemon.searchBox)
		{
			statemon.searchBox.style.display = statemon.togglers.searchBoxOpen ? 'none' : 'flex';
			statemon.elTemp = document.getElementById('statemon-button-toggleSearch');
			if(statemon.elTemp)
			{
				statemon.elTemp.style.color = statemon.togglers.searchBoxOpen ? statemon.options.colors.background.colorTrue : statemon.options.colors.background.colorFalse;
			}
		}

		statemon.togglers.searchBoxOpen = !statemon.togglers.searchBoxOpen;
	},
	toggleBox(box, id, toggler, showText, hideText)
	{
		// show/hide the change box (browser output)
		if(box)
		{
			box.style.display = statemon.togglers[toggler] ? 'none' : 'flex';
			statemon.elTemp = document.getElementById(id);
			if(statemon.elTemp) statemon.elTemp.innerText = statemon.togglers[toggler] ? showText : hideText;
		}

		statemon.togglers[toggler] = !statemon.togglers[toggler];
	},
	/* On click listeners: */
	toggleMonitoring()
	{
		statemon.toggleSomething('statemon-button-toggleMonitoring', 'monitoring', statemon.monitor, 'stop monitoring', 'start monitoring');
	},
	toggleHideAdded()
	{
		statemon.toggleSomething('statemon-button-toggleHideAdded', 'showAdded', null, 'hide additions', 'show additions');
	},
	toggleSomething(id, bool, callbackFn, textStarted = null, textStopped = null)
	{
		statemon.elTemp = document.getElementById(id);
		if(!statemon.togglers[bool])
		{
			// fire it up
			if(textStarted) statemon.elTemp.innerText = textStarted;

			statemon.elTemp.style.color = statemon.options.colors.background.colorFalse;
			statemon.togglers[bool] = true;
			if(callbackFn) callbackFn();
		}
		else
		{
			// kill it
			if(textStopped) statemon.elTemp.innerText = textStopped;

			statemon.elTemp.style.color = statemon.options.colors.background.colorTrue;
			statemon.togglers[bool] = false;
		}
	},
	toggleSearchLoading()
	{
		statemon.elTemp = document.getElementById('statemon-search-go');

		if(statemon.elTemp)
		{
			if(statemon.searchActive)
			{
				statemon.elTemp.innerHTML = 'Loading';
			}
			else
			{
				statemon.elTemp.innerHTML = 'Go';
			}
		}
		else
		{
			console.log('no search button');
		}
	},
	/* Helpers: */
	isObjWithKeys(item)
	{
		return item && (typeof item === 'object') && Object.keys(item)?.length > 0;
	},
	isReallyAnArray(item)
	{
		return item && Array.isArray(item) && item.length > 0; // don't judge me
	},
	logArrayItems(arr, target = null)
	{
		// get the target div
		target = (target === 'search') ? statemon.searchBox : statemon.changeBox;

		if(target === statemon.searchBox)
		{
			// clear the results first
			if(statemon.searchBox.children.length > 1)
			{
				while(statemon.searchBox.firstChild && (statemon.searchBox.children.length > 1))
				{
					statemon.searchBox.removeChild(statemon.searchBox.firstChild);
				}
			}
		}

		// silence stuff, for example 'app,loading'
		if(statemon.options.silence.length > 0)
		{
			arr = arr.filter((x) =>
			{
				return !statemon.options.silence.includes(x.item);
			});
		}

		// iterate over the changes
		if(statemon.options.logTarget === 'console')
		{
			// print out each item of the array for chrome console
			// this prevents having to evaluate the object on click
			arr.forEach((x, i) => statemon.logItemToConsole(x, i));
		}
		else if(statemon.options.logTarget === 'browser')
		{
			arr.forEach((x, i) => statemon.logItemToBrowser(x, i, target));
		}
	},
	logItemToConsole(x, i)
	{
		if(x.status === 'added' && statemon.togglers.showAdded)
		{
			console.log(
				i,
				x.item,
				statemon.options.added.message,
				x.newVal
			);
		}
		else if(x.status === 'changed')
		{
			console.log(
				i,
				x.item,
				statemon.options.changed.message,
				statemon.options.changed.from, x.oldVal,
				statemon.options.changed.to, x.newVal
			);
		}
	},
	logItemToBrowser(x, i, target)
	{
		if(target)
		{
			if(target === statemon.searchBox)
			{
				statemon.browserLogTxt = `
                <div class='scb-added'>
                    <div class='scb-item'>[${i}] ${x.item.replaceAll(',', '/')}</div>
                    <div class='scb-newVal'>${x.newVal}</div>
                </div>`;

				target.innerHTML = statemon.browserLogTxt + target.innerHTML;
			}
			else if(x.status === 'added' && statemon.togglers.showAdded)
			{
				statemon.browserLogTxt = `
                <div class='scb-added'>
                    <div class='scb-item'>[${i}] ${x.item.replaceAll(',', '/')}</div>
                    <div class='scb-newVal'>${x.newVal}</div>
                </div>`;

				target.innerHTML = statemon.browserLogTxt + target.innerHTML;
			}
			else if(x.status === 'changed')
			{
				statemon.browserLogTxt = `
                <div class='scb-changed'>
                    <div class='scb-item'>[${i} ${x.item.replaceAll(',', '/')}]</div>
                    <div class='scb-oldVal'>${x.oldVal}</div>
                    <div class='scb-newVal'>${x.newVal}</div>
                </div>`;

				target.innerHTML = statemon.browserLogTxt + target.innerHTML;
			}
		}
	},
	/* The hard workers: */
	getStateData()
	{
		/* get the state and copy it to a new object */
		// clear the cache
		statemon.stateCache = {};
		// for each key:
		// TODO: refactor this for other sites:
		// instead of using keysBase, find the keys in the state
		// and iterate over them instead
		statemon.stateKeys = statemon.options.isAluminati ? statemon.options.keysBase : Object.keys(statemon.state);
		// statemon.options.keysBase.forEach((key) =>
		statemon.stateKeys.forEach((key) =>
		{
			// try to stringify the object
			try
			{
				statemon.stateCache[key] = JSON.parse(JSON.stringify(statemon.state[key]));
			}
			catch(e)
			{
				statemon.stateCache[key] = {};
				Object.keys(statemon.state[key]).forEach((k) =>
				{
					// try to copy deeper (app or admin needs this to work) (I forgot which)
					try
					{
						statemon.stateCache[key][k] = JSON.parse(JSON.stringify(statemon.state[key][k]));
					}
					catch(e)
					{ /* do nothing */ }
				});
			}
		});

		return statemon.stateCache;
	},
	monitor()
	{
		/* monitor the state with a loop */
		// start checking ram usage
		statemon.ramInterval = setInterval(() =>
		{
			if(!statemon.togglers.monitoring)
			{
				clearInterval(statemon.ramInterval);
			}
			else
			{
				statemon.updateRamUsage();
			}
		}, 1000);

		// check the state exists
		if(statemon.state)
		{
			if(statemon.togglers.monitoring)
			{
				console.log('Monitoring started.');
			}

			statemon.monitorInterval = setInterval(() =>
			{
				// destroy on max count
				if(!statemon.togglers.monitoring)
				{
					if(statemon.monitorInterval)
					{
						clearInterval(statemon.monitorInterval);
						console.log('Monitoring finished - toggled by user.');
					}
				}

				if(statemon.shouldDieBecauseTooMuchRam())
				{
					clearInterval(statemon.monitorInterval);
					console.log('Monitoring finished - too much RAM.');
				}

				statemon.monitorFn();
			}, statemon.options.intervalMillis);
		}
		else
		{
			console.log('State not available.');
		}
	},
	monitorFn()
	{
		/* this is intended to be inside a loop! */
		if(!statemon.togglers.monitoringBusy)
		{
			statemon.togglers.monitoringBusy = true;

			// fill the dump with flat values pulled from the state
			statemon.iterateThis(statemon.getStateData(), statemon.addToDump, statemon.cacheNew);

			// check if there is an old cache
			if(Object.keys(statemon.cacheOld).length > 0)
			{
				// clear changes
				statemon.changeArray = [];

				// check each cache's values against each other
				Object.keys(statemon.cacheNew).forEach((key) =>
				{
					statemon.oldValTemp = JSON.stringify(statemon.cacheOld[key]);
					statemon.newValTemp = JSON.stringify(statemon.cacheNew[key]);
					if(statemon.cacheOld[key] === undefined)
					{
						// item did not exist
						statemon.changeArray.push({
							status: 'added',
							item: key,
							oldVal: statemon.oldValTemp,
							newVal: statemon.newValTemp
						});
					}
					else if(statemon.oldValTemp !== statemon.newValTemp)
					{
						// item existed already && has changed
						statemon.changeArray.push({
							status: 'changed',
							item: key,
							oldVal: statemon.oldValTemp,
							newVal: statemon.newValTemp
						});
					}
				});

				statemon.logArrayItems(statemon.changeArray);
			}

			// fill the old cache for the next iteration
			// statemon.iterateThis(getStateData(), statemon.addToDump, statemon.cacheOld);
			statemon.cacheOld = {};
			statemon.cacheOld = { ...statemon.cacheNew }; // less hard work for the cpu

			statemon.togglers.monitoringBusy = false;
		}
	},
	getSnapshot()
	{
		/* dump the state to the console */
		if(statemon.stateCache && Object.keys(statemon.stateCache).length > 0)
		{
			console.log('Statemon snapshot::', statemon.stateCache);
		}
		else
		{
			statemon.monitorFn();
			statemon.getSnapshot();
		}
	},
	doStuffToThings(thingy, callbackFn)
	{
		/* do stuff to all the stuff in the thing */
		if(statemon.isObjWithKeys(thingy))
		{
			// get the keys & recurse
			Object.keys(thingy).forEach((key) =>
			{
				statemon.iterateThis(thingy[key]);
			});
		}
		else if(statemon.isReallyAnArray(thingy))
		{
			thingy.forEach((subThingy) =>
			{
				statemon.iterateThis(subThingy);
			});
		}
		else
		{
			callbackFn(thingy);
		}
	},
	addToDump(arr, dump)
	{
		/* Fill a dump array with flattened values from an array (i.e. statemon.changeArray) */
		// set value in array: arr['path,to,item'] = value
		statemon.dumpVal = arr.pop();
		dump[arr.toString()] = statemon.dumpVal;
	},
	iterateThis(thingy, callbackFn, dump, depth = 0, breadcrumb = [])
	{
		/* do [callbackFn] to each non-object-or-array in the [thingy] up to [depth] */
		/* passes [...breadcrumb, thingy] to [callbackFn]; handle this appropriately */

		// break on max depth
		if(depth > 24) return;

		if(statemon.isObjWithKeys(thingy))
		{
			// get the keys & recurse
			Object.keys(thingy).forEach((key) =>
			{
				statemon.iterateThis(thingy[key], callbackFn, dump, depth + 1, [...breadcrumb, key]);
			});
		}
		else if(statemon.isReallyAnArray(thingy))
		{
			// recurse for each element
			thingy.forEach((subThingy) =>
			{
				statemon.iterateThis(subThingy, callbackFn, dump, depth + 1, [...breadcrumb, subThingy]);
			});
		}
		else
		{
			// stop recursing
			callbackFn([...breadcrumb, thingy], dump);
			// [...breadcrumb] is the path to the item & [thingy] is the value of the item
		}
	},
	/* Failsafes: */
	shouldDieBecauseTooMuchRam()
	{
		/* check RAM usage and empty vars if full */
		if(statemon.currentRamUsage() > 500)
		{
			statemon.cacheNew = {};
			statemon.cacheOld = {};
			statemon.stateCache = {};
		}

		return statemon.currentRamUsage() > 500;
	},
	trimChanges()
	{
		/* remove elements from changeBox if it gets too large */
		if(statemon.changeBox.children.length > 50)
		{
			while(statemon.changeBox.firstChild && (statemon.changeBox.children.length > 20))
			{
				statemon.changeBox.removeChild(statemon.changeBox.lastChild);
			}
		}
	},
	updateRamUsage()
	{
		/* output RAM usage to the ui */
		if(statemon.togglers.monitoring)
		{
			statemon.ramBox = document.getElementById('statemon-button-status');
			statemon.currentRamUsageAmount = statemon.currentRamUsage();

			if(statemon.currentRamUsageAmount > 500) statemon.shouldDieBecauseTooMuchRam();

			if(statemon.ramBox) statemon.ramBox.innerHTML = `RAM: ${statemon.currentRamUsageAmount} MB`;
		}
	},
	currentRamUsage()
	{
		/* get current RAM usage */
		return Math.round(window.performance?.memory?.usedJSHeapSize / 1048536) || -1;
	},
	/* Search: */
	searchCache()
	{
		/* search the cache for a string */
		statemon.searchKeyword = null;
		statemon.searchFilters = null;
		statemon.searchFiltersString = null;
		statemon.searchKeyword = document.getElementById('statemon-search-input')?.value || '';
		statemon.searchKeyword = statemon.searchKeyword.toLowerCase(); // todo: add case match support
		statemon.searchFilters = [];
		statemon.searchFiltersString = document.getElementById('statemon-search-filter')?.value || '';

		if(statemon.searchFiltersString !== '')
		{
			// make it an array
			statemon.searchFilters = statemon.searchFiltersString.split(';');
		}

		// build a cache if none exists
		if(Object.keys(statemon.cacheNew)?.length === 0 && !statemon.togglers.monitoring)
		{
			statemon.monitorFn();
			statemon.searchCache();

			return;
		}

		// search
		if(statemon.searchKeyword !== '' && Object.keys(statemon.cacheNew)?.length > 0)
		{
			statemon.searchResults = [];
			statemon.searchActive = true;
			statemon.toggleSearchLoading();

			if(statemon.searchFilters.length > 0)
			{
				// iterate over the object and find the keyword
				Object.keys(statemon.cacheNew).forEach((key) =>
				{
					if(statemon.searchResults.length < statemon.options.searchResultsLimit)
					{
						// apply the filter
						statemon.searchFilters.forEach((item) =>
						{
							if(key.indexOf(item) > -1)
							{
								if(JSON.stringify(statemon.cacheNew[key]).toLowerCase().indexOf(statemon.searchKeyword) > -1)
								{
									// keyword found
									statemon.searchResults.push({
										item: key,
										newVal: statemon.cacheNew[key]
									});
								}
							}
						});
					}
				});
			}
			else
			{
				// iterate over the object and find the keyword
				Object.keys(statemon.cacheNew).forEach((key) =>
				{
					if(statemon.searchResults.length < statemon.options.searchResultsLimit)
					{
						if(JSON.stringify(statemon.cacheNew[key]).toLowerCase().indexOf(statemon.searchKeyword) > -1)
						{
							// keyword found
							statemon.searchResults.push({
								item: key,
								newVal: statemon.cacheNew[key]
							});
						}
					}
				});
			}

			if(statemon.options.printSearchResultsToConsoleAsWell)
			{
				console.log('statemon search results:', statemon.searchResults);
			}

			if(statemon.searchResults.length === 0)
			{
				statemon.searchResults.push({
					item: 'No results!',
					newVal: null
				});
			}

			// trim the array
			while(statemon.searchResults.length > statemon.options.searchResultsLimit)
			{
				statemon.searchResults.pop();
			}

			setTimeout(() =>
			{
				statemon.searchActive = false;
				statemon.toggleSearchLoading();
				statemon.logArrayItems(statemon.searchResults, 'search');
			}, 200);
		}
	},
	/* Find access to the state or raise error flag: */
	findStatefulDivs()
	{
		statemon.statefulArr1 = [...document.body.children].filter((element) =>
		{
			return element?.__vue__?.$store?.state !== undefined;
		});

		if(statemon.statefulArr1.length === 0)
		{
			statemon.togglers.hasErrors = true;
			statemon.statefulArr2 = [...document.body.children].filter((element) =>
			{
				return element?.__vue__ !== undefined;
			});

			if(statemon.statefulArr2.length > 0)
			{
				console.log('Statemon: Vue detected but without access to the state! Vue divs:', statemon.statefulArr2);
			}
		}

		return statemon.statefulArr1;
	}
};

statemon.init();
