/* Statemon */ statemon_version = '1.9'; /* Monitor the Vue state on live sites and localhost */
let notes = {
    //: Instructions: Open Chrome, then Devtools (f12). Go to Sources, then Snippets.
    //: Add a snippet, name it, paste this script & run it (ctrl+Enter)
    //: Click a button to start ('monitor' to start monitoring)
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
    // ----
    // TODO (please help if you are able):
    // search without requiring a keyword (with * for wildcard)
    // allow case match in search
    // affix statemon-container to the document so that it scrolls with the page
    // RAM usage climbs by about 2MB per second. What is doing this?
    // containerize all variables so they aren't window.(options/togglers/etc)
    // - should be window.statemon.options etc
};
/* Initialize variables: */
let options = {
    isAluminati: false, // set true if you want to filter the keys using keysBase[]
    colors: {
        background: {
            "false": "#aa000080", "true": "#00aa0080"
            // "true": "", "false": "" // inert - too buggy (nvm fixed-ish)
        }
    },
    searchResultsLimit: 100, // limit the search results. you don't want to add 4000 new divs
    printSearchResultsToConsoleAsWell: false, // no comment
    intervalMillis: 500, // monitor() will check every x millis (higher = performance, lower = accuracy)
    logTarget: 'browser', // browser or console
    changed: {
        // e.g. 'item' [message] [from] oldVal [to] newVal
        message: '::',
        from: '',
        to: '-->',
    },
    added: {
        // e.g. 'item' [message] newVal
        message: 'added:'
    },
    silence: [
        // add keys here you don't want to hear about
        'app,loading','entities,loading',
        //'app,activeModuleId','app,activePageId'
    ],
    keysBase: [
        // comment out whatever you don't want to monitor (greatly improves performance)
        "app", "statistics", "user", "profiles", "userLists",
        "admin", "dataSchemas", "entities", "powerUps",
        "applications", "entityDefinitions", "communications", "emailTemplates",
        "chats", "dataMappings", "handlebars"
    ],
    keysBase0: [
        // all the top level keys you'd expect to find in the state (as of May 2021)
        "audit", "app", "statistics", "user", "profileFormCopy", "profiles", "userLists",
        "admin", "i18n", "files", "fileLists", "dataSchemas", "entities", "powerUps",
        "applications", "entityDefinitions", "communications", "emailTemplates",
        "external", "chats", "reportAbuse", "dataMappings", "handlebars"
    ]
};
let togglers = {
    // booleans for toggling
    monitoring: false,
    monitoringBusy: false, // to prevent concurrent looping
    showAdded: false, // show NEW items in the state (set to true if you like clutter)
    hasErrors: false, // flag if errors found
    boxOpen: true // changeBox open/closed
};
let cacheNew = {}, // created on first loop of monitorFn
    cacheOld = {}, // doesn't exist until second loop of monitorFn
    app = null, // div#app
    store = null, // app.__vue__.$store
    state = null, // store.state
    changeArray = [], // changes get pushed here
    container = null, // container for the buttons
    changeBox = null, // text box into which to output changes
    searchBox = null, // box to search the state
    dumpVal = null, // pointer for addToDump
    buttonOffsetTop = 50, // so the buttons aren't on top of each other
    toggler = null, // for toggling buttons
    browserLogTxt = '', // to output to the browser
    stateCache = {}, // getStateData() cache
    stateKeys = [], // getStateData() keys
    oldValTemp = null, // temp variable for comparisons
    newValTemp = null, // temp variable for comparisons
    searchActive = false, // flag for search function
    searchKeyword = '',
    searchResults = [], // array to store search results
    searchFilters = [], // to filter results by source
    searchFiltersString = '',
    clickers = null,
    statefulDivs = [],
    monitorInterval = null, // monitoring loop
    ramInterval = null, // ram usage indicator loop
    currentRamUsageAmount = 0,
    ramBox = null; // ram usage indicator

function init() {
    // remove statemon stuff if on first run
    document.getElementById('statemon-container')?.remove();
    // check that the state exists (not much point running if it doesn't)
    statefulDivs = findStatefulDivs();
    if(statefulDivs.length > 0)
    {
        // get app, store, state
        app = statefulDivs[0];
        store = app?.__vue__.$store || null;
        state = store?.state || null;
        addTheStyles(); // make the buttons bearable
        addButtonContainer(); // does what it says
        createClickers();
        createButton('status', null, 'status');
        createButton('snapshot', getSnapshot, 'snapshot');
        createButton('toggleMonitoring', toggleMonitoring, 'monitor');
        createButton('toggleChanges', toggleChangeBox, 'hide changes');
        createButton('toggleHideAdded', toggleHideAdded, 'show additions');
        createButton('toggleSearchBox', toggleSearchBox, 'search');
        createSearchBox();
        createChangeBox();
        document.addEventListener('keydown', hideChangesOnKey);
    }
    else
    {
        togglers.hasErrors = true;
        console.log('Vue state not detected!');
    }
} init(); /* just to collapse it */
/* Styles and logic for the ui: */
function hideChangesOnKey(e) {
    // hide the changeBox when a key is pressed
    if(e.keyCode == 17) // ctrl = 17
    {
        toggleChangeBox();
    }
}
function addTheStyles() {
    // add some nice styling for the buttons

    // remove existing styles
    document.getElementById('statemon-style')?.remove();

    var style = document.createElement('style');
    if(style)
    {
        style.id = 'statemon-style';
        style.innerHTML = `
            #statemon-search-form-container {
                display: flex;
            }
            #statemon-search-input {
                flex-grow: 1;
                width: 85%;
            }
            #statemon-search-filter {
                flex-grow: 1;
                width: 85%;
            }
            #statemon-search-go {
                width: 10%;
            }
            .statemon-container {
                position: absolute;
                top: 120px;
                z-index: 1000000000;
            }
            .statemon-changeBox {
                position: absolute;
                right: 10px;
                width: auto;
                width: 50%;
                max-width: 600px;
                min-width: 300px;
                height: 300px;
                overflow-y: scroll;
                color: green;
                padding: 8px;
                margin-top: 8px;
                display: flex;
                flex-direction: column;
                background: #bbbbbbf0;
            }
            .statemon-searchBox {
                overflow-x: hidden;
                position: absolute;
                right: 10px;
                width: 50%;
                max-width: 600px;
                min-width: 300px;
                height: 300px;
                overflow-y: scroll;
                color: green;
                padding: 8px;
                margin-top: 8px;
                display: flex;
                flex-direction: column-reverse;
                background: #bbbbbbf0;
            }
            .statemon-changeBox > div {
                flex-grow: 1;
            }
            .scb-changed {
                color: green;
                border-bottom: 1px solid black;
            }
            .scb-added {
                color: blue;
                border-bottom: 1px solid black;
            }
            .scb-changed:hover {
                color: green;
                background: white;
            }
            .scb-item {
                color: black;
            }
            .scb-oldVal {
                color: maroon;
            }
            .scb-newVal {
                color: green;
            }
            .statemon-button {
                padding: 8px;
                margin: 2px;
                border: 1px solid green;
                border-radius: 6px;
                cursor: pointer;
                width: auto;
                height: auto;
                z-index: 1000000000;
            }
            .statemon-link-container {
                position: absolute;
                right: 10px;
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
            }
            .statemon-link {
                position: absolute;
                right: 20px;
                padding: 0 8px;
                border: 1px solid green;
                border-radius: 20px;
                cursor: pointer;
                width: auto;
                height: auto;
                text-align: center;
            }
            .statemon-button:hover {
                box-shadow: 0px 0px 0px 12px rgba(0,0,0,0.1);
                width: auto;
            }
        `;
        document.head.appendChild(style);
    }
}
function addButtonContainer() {
    var protoContainer = document.createElement('div');
    protoContainer.id = 'statemon-container';
    protoContainer.className += ' z-top ';
    document.body.appendChild(protoContainer); // todo: make this scroll with the page
    container = document.getElementById('statemon-container');
}
function _createButton(id, onclick, label) {
    // deprecated in v1.9 - improved buttons
    // remove existing buttons
    document.getElementById('statemon-button-' + id)?.remove();
    // create the button
    var btn = document.createElement('button');
    if(btn && container)
    {
        btn.id = 'statemon-button-' + id;
        btn.innerText += label;
        btn.className += 'statemon-button';
        btn.style.top = 200 + buttonOffsetTop + 'px';
        btn.addEventListener("click", onclick);
        container.appendChild(btn);
        // buttonOffsetTop += 50;
    }
}
function createButton(id, onclick, label) {
    // remove existing buttons
    document.getElementById('statemon-button-' + id)?.remove();
    // create the button
    var btn = document.createElement('button');
    if(btn && container)
    {
        btn.id = 'statemon-button-' + id;
        btn.innerText += label;
        btn.className += 'statemon-button';
        // btn.style.top = 200 + buttonOffsetTop + 'px';
        btn.addEventListener("click", onclick);
        clickers?.appendChild(btn);
        // buttonOffsetTop += 50;
    }
}
function createClickers() {
    // remove existing box
    document.getElementById('statemon-clickers')?.remove();
    // create the box
    clickers = document.createElement('div');
    if(clickers)
    {
        clickers.id = 'statemon-clickers';
        clickers.className += 'statemon-link-container statemon-clickers';
        clickers.style.top = '200px';
        container?.appendChild(clickers);
        clickers = document.getElementById('statemon-clickers');
    }
}
function createChangeBox() {
    // remove existing box
    document.getElementById('statemon-changeBox')?.remove();
    // create the box
    changeBox = document.createElement('div');
    if(changeBox)
    {
        changeBox.id = 'statemon-changeBox';
        changeBox.className += 'statemon-changeBox';
        changeBox.style.top = 301 + buttonOffsetTop + 'px';
        container?.appendChild(changeBox);
        buttonOffsetTop += 500;
        changeBox = document.getElementById('statemon-changeBox');
    }
}
function createSearchBox() {
    // remove existing box
    document.getElementById('statemon-searchBox')?.remove();
    // create the box
    searchBox = document.createElement('div');
    if(searchBox && container)
    {
        searchBox.id = 'statemon-searchBox';
        searchBox.className += 'statemon-searchBox';
        searchBox.style.top = 200 + buttonOffsetTop + 'px';
        container?.appendChild(searchBox);
        buttonOffsetTop += 200;
        searchBox = document.getElementById('statemon-searchBox');

        searchBox.innerHTML += `
<div id="statemon-search-input-container">
    <input type="text" placeholder="Search the state..." id="statemon-search-input" value="` + searchKeyword + `" />
    <input type="text" placeholder="Filter by tag (delimiter: ;)" id="statemon-search-filter" value="` + searchFiltersString + `" />
    <button onClick="searchCache()" id="statemon-search-go">Go</button>
</div>
        `;
    }
}
function toggleSearchBox() {
    if(el)
    {
        el.style.color = togglers.boxOpen ? options.colors.background.true : options.colors.background.false;
    }
    // show/hide the search box (browser output)
    if(searchBox)
    {
        searchBox.style.display = togglers.boxOpen ? 'none' : 'flex';
        var el = document.getElementById('statemon-button-toggleSearch');
        if(el)
        {
            el.style.color = togglers.boxOpen ? options.colors.background.true : options.colors.background.false;
        }
    }

    togglers.boxOpen = !togglers.boxOpen;
}
function toggleChangeBox() {
    // show/hide the change box (browser output)
    if(changeBox)
    {
        changeBox.style.display = togglers.boxOpen ? 'none' : 'flex';
        var el = document.getElementById('statemon-button-toggleChanges');
        if(el)
        {
            el.style.color = togglers.boxOpen ? options.colors.background.true : options.colors.background.false;
            el.innerText = togglers.boxOpen ? 'show changes' : 'hide changes';
        }
    }

    togglers.boxOpen = !togglers.boxOpen;
}
function toggleBox(box, id, toggler, showText, hideText) {
    // show/hide the change box (browser output)
    if(box)
    {
        box.style.display = togglers[toggler] ? 'none' : 'flex';
        var el = document.getElementById(id);
        if(el) el.innerText = togglers[toggler] ? showText : hideText;
    }

    togglers[toggler] = !togglers[toggler];
}
/* On click listeners: */
function toggleMonitoring() {
    toggleSomething('statemon-button-toggleMonitoring', 'monitoring', monitor, 'stop monitoring', 'start monitoring');
}
function toggleHideAdded() {
    toggleSomething('statemon-button-toggleHideAdded', 'showAdded', null, 'hide additions', 'show additions');
}
function toggleSomething(id, bool, callback, textStarted = null, textStopped = null) {
    toggler = document.getElementById(id);
    if(!togglers[bool])
    {
        // fire it up
        if(textStarted) toggler.innerText = textStarted;
        toggler.style.color =  options.colors.background.false;
        togglers[bool] = true;
        if(callback) callback();
        return;
    }
    else
    {
        // kill it
        if(textStopped) toggler.innerText = textStopped;
        toggler.style.color = options.colors.background.true;
        togglers[bool] = false;
        return;
    }
}
function toggleSearchLoading() {
    goButton = document.getElementById('statemon-search-go');

    if(goButton)
    {
        if(searchActive)
        {
            goButton.innerHTML = 'Loading';
        }
        else
        {
            goButton.innerHTML = 'Go';
        }
    }
    else
    {
        console.log('no search button');
    }
}
/* Helpers: */
function isObjWithKeys(item) {
    return item && (typeof item === 'object') && Object.keys(item)?.length > 0;
}
function isReallyAnArray(item) {
    return item && Array.isArray(item) && item.length > 0; // don't judge me
}
function logArrayItems(arr, target = null) {
    // get the target div
    target = (target === 'search') ? searchBox : changeBox;

    if(target === searchBox)
    {
        // clear the results first
        if(searchBox.children.length > 1)
        {
            while (
                searchBox.firstChild
                && (searchBox.children.length > 1)
            ) {
                searchBox.removeChild(searchBox.firstChild);
            }
        }
    }
    // silence stuff, for example 'app,loading'
    if(options.silence.length > 0)
    {
        arr = arr.filter((x) =>
        {
            return !options.silence.includes(x.item);
        });
    }
    // iterate over the changes
    if(options.logTarget === 'console')
    {
        // print out each item of the array for chrome console
        // this prevents having to evaluate the object on click
        arr.forEach((x, i) => logItemToConsole(x, i));
    }
    else if(options.logTarget === 'browser')
    {
        arr.forEach((x, i) => logItemToBrowser(x, i, target));
    }
}
function logItemToConsole(x, i) {
    if(x.status === 'added' && togglers.showAdded)
    {
        console.log(
            i,
            x.item,
            options.added.message,
            x.newVal
        );
    }
    else if(x.status === 'changed')
    {
        console.log(
            i,
            x.item,
            options.changed.message,
            options.changed.from, x.oldVal,
            options.changed.to, x.newVal
        );
    }
}
function logItemToBrowser(x, i, target) {
    if(target)
    {
        if(target === searchBox)
        {
            //console.log(tag + ' ' + i,x.item,options.added.message,x.newVal);
            browserLogTxt = `
            <div class='scb-added'>
                <div class='scb-item'>` + '[' + i + '] ' + x.item.replaceAll(',', '/') + `</div>
                <div class='scb-newVal'>` + x.newVal + `</div>
            </div>
            `;
            target.innerHTML = browserLogTxt + target.innerHTML;
        }
        else if(x.status === 'added' && togglers.showAdded)
        {
            //console.log(tag + ' ' + i,x.item,options.added.message,x.newVal);
            browserLogTxt = `
            <div class='scb-added'>
                <div class='scb-item'>` + '[' + i + '] ' + x.item.replaceAll(',', '/') + `</div>
                <div class='scb-newVal'>` + x.newVal + `</div>
            </div>
            `;
            target.innerHTML = browserLogTxt + target.innerHTML;
        }
        else if(x.status === 'changed')
        {
            browserLogTxt = `
            <div class='scb-changed'>
                <div class='scb-item'>` + '[' + i + ']' + x.item.replaceAll(',', '/') + `</div>
                <div class='scb-oldVal'>` + x.oldVal + `</div>
                <div class='scb-newVal'>` + x.newVal + `</div>
            </div>
            `;
            target.innerHTML = browserLogTxt + target.innerHTML;
        }
    }
}
/* The hard workers: */
function getStateData() {
    /* get the state and copy it to a new object */
    // clear the cache
    stateCache = {};
    // for each key:
    // TODO: refactor this for other sites:
    // instead of using keysBase, find the keys in the state
    // and iterate over them instead
    stateKeys = options.isAluminati ? options.keysBase : Object.keys(state);
    // options.keysBase.forEach((key) =>
    stateKeys.forEach((key) =>
    {
        // try to stringify the object
        try
        {
            stateCache[key] = JSON.parse(JSON.stringify(state[key]));
        }
        catch(e)
        {
            stateCache[key] = {};
            Object.keys(state[key]).forEach((k) =>
            {
                // try to copy deeper (app or admin needs this to work) (I forgot which)
                try { stateCache[key][k] = JSON.parse(JSON.stringify(state[key][k])); }
                catch(e) {/* do nothing */}
            });
        }
    });

    return stateCache;
}
function monitor() {
    /* monitor the state with a loop */ 
    // start checking ram usage
    ramInterval = setInterval(() => {
        if(!togglers.monitoring)
        {
            clearInterval(ramInterval);
        }
        else
        {
            updateRamUsage();
        }
    }, 1000);
    // check the state exists
    if(state)
    {
        if(togglers.monitoring)
        {
            console.log('Monitoring started.');
        }
        monitorInterval = setInterval(() =>
        {
            // destroy on max count
            if(!togglers['monitoring'])
            {
                clearInterval(monitorInterval);
                console.log('Monitoring finished - toggled by user.');
            }
            if(shouldDieBecauseTooMuchRam())
            {
                clearInterval(monitorInterval);
                console.log('Monitoring finished - too much RAM.');
            }

            monitorFn();
        }, options.intervalMillis);
    }
    else
    {
        console.log('State not available.');
    }
}
function monitorFn() {
    /* this is intended to be inside a loop! */
    if(togglers.monitoringBusy)
    {
        return;
    }
    else
    {
        togglers.monitoringBusy = true;

        // fill the dump with flat values pulled from the state
        iterateThis(getStateData(), addToDump, cacheNew);

        // check if there is an old cache
        if(Object.keys(cacheOld).length > 0)
        {
            // clear changes
            changeArray = [];

            // check each cache's values against each other
            Object.keys(cacheNew).forEach((key) =>
            {
                oldValTemp = JSON.stringify(cacheOld[key]);
                newValTemp = JSON.stringify(cacheNew[key]);
                if(cacheOld[key] === undefined)
                {
                    // item did not exist
                    changeArray.push({
                        status: 'added',
                        item: key,
                        oldVal: oldValTemp,
                        newVal: newValTemp
                    });
                }
                else if(oldValTemp !== newValTemp)
                {
                    // item existed already && has changed
                    changeArray.push({
                        status: 'changed',
                        item: key,
                        oldVal: oldValTemp,
                        newVal: newValTemp
                    });
                }
            });

            logArrayItems(changeArray);
        }

        // fill the old cache for the next iteration
        // iterateThis(getStateData(), addToDump, cacheOld);
        cacheOld = {};
        cacheOld = {...cacheNew}; // less hard work for the cpu

        togglers.monitoringBusy = false;
    }
}
function getSnapshot() {
    /* dump the state to the console */
    if(Object.keys(stateCache)?.length > 0)
    {
        console.log('Statemon snapshot::', stateCache);
    }
    else
    {
        monitorFn();
        getSnapshot();
    }
}
function doStuffToThings(thingy, callback) {
    /* do stuff to all the stuff in the thing */
    if(isObjWithKeys(thingy))
    {
        // get the keys & recurse
        Object.keys(thingy).forEach((key) =>{
            iterateThis(thingy[key]);
        });
    }
    else if(isReallyAnArray(thingy))
    {
        thingy.forEach((subThingy) =>{
            iterateThis(subThingy);
        });
    }
    else
    {
        callback(thingy);
    }
}
function addToDump(arr, dump) {
    /* Fill a dump array with flattened values from an array (i.e. changeArray) */
    // set value in array: arr['path,to,item'] = value
    dumpVal = arr.pop();
    dump[arr.toString()] = dumpVal;
}
function iterateThis(thingy, callback, dump, depth = 0, breadcrumb = [])
{
    /* do [callback] to each non-object-or-array in the [thingy] up to [depth] */
    /* passes [...breadcrumb, thingy] to [callback]; handle this appropriately */

    // break on max depth
    if(depth > 24) return;

    if(isObjWithKeys(thingy))
    {
        // get the keys & recurse
        Object.keys(thingy).forEach((key) =>
        {
            iterateThis(thingy[key], callback, dump, depth + 1, [...breadcrumb, key]);
        });
    }
    else if(isReallyAnArray(thingy))
    {
        // recurse for each element
        thingy.forEach((subThingy) =>
        {
            iterateThis(subThingy, callback, dump, depth + 1, [...breadcrumb, subThingy]);
        });
    }
    else
    {
        // stop recursing
        callback([...breadcrumb, thingy], dump);
        // [...breadcrumb] is the path to the item & [thingy] is the value of the item
    }
}
/* Failsafes: */
function shouldDieBecauseTooMuchRam() {
    /* check RAM usage and empty vars if full */ 
    if(currentRamUsage() > 500)
    {
        cacheNew = {};
        cacheOld = {};
        stateCache = {};
    }
}
function trimChanges() {
    /* remove elements from changeBox if it gets too large */
    if(changeBox.children.length > 50)
    {
        while (
            changeBox.firstChild
            && (changeBox.children.length > 20)
        ) {
            changeBox.removeChild(changeBox.lastChild);
        }
    }
}
function updateRamUsage() {
    /* output RAM usage to the ui */ 
    if(togglers.monitoring)
    {
        ramBox = document.getElementById('statemon-button-status');
        currentRamUsageAmount = currentRamUsage();
        if(currentRamUsageAmount > 500) shouldDieBecauseTooMuchRam();
        if(ramBox) ramBox.innerHTML = 'RAM: ' + currentRamUsageAmount + ' MB';
    }
}
function currentRamUsage() {
    /* get current RAM usage */ 
    return Math.round(window.performance.memory.usedJSHeapSize / 1048536);
}
/* Search: */
function searchCache() {
    /* search the cache for a string */
    searchKeyword = null;
    searchFilters = null;
    searchFiltersString = null;
    searchKeyword = document.getElementById('statemon-search-input')?.value || '';
    searchKeyword = searchKeyword.toLowerCase(); // todo: add case match support
    searchFilters = [];
    searchFiltersString = document.getElementById('statemon-search-filter')?.value || '';

    if(searchFiltersString !== '')
    {
        // make it an array
        searchFilters = searchFiltersString.split(';');
    }

    // build a cache if none exists
    if(Object.keys(cacheNew)?.length === 0 && !togglers.monitoring)
    {
        monitorFn();
        searchCache();
        return;
    }

    // search
    if(searchKeyword !== '' && Object.keys(cacheNew)?.length > 0)
    {
        searchResults = [];
        searchActive = true;
        toggleSearchLoading();

        if(searchFilters.length > 0)
        {
            // iterate over the object and find the keyword
            Object.keys(cacheNew).forEach((key) =>
            {
                if(searchResults.length < options.searchResultsLimit)
                {
                    // apply the filter
                    searchFilters.forEach((item) =>
                    {
                        if(key.indexOf(item) > -1)
                        {
                            if(JSON.stringify(cacheNew[key]).toLowerCase().indexOf(searchKeyword) > -1)
                            {
                                // keyword found
                                searchResults.push({
                                    item: key,
                                    newVal: cacheNew[key]
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
            Object.keys(cacheNew).forEach((key) =>
            {
                if(searchResults.length < options.searchResultsLimit)
                {
                    if(JSON.stringify(cacheNew[key]).toLowerCase().indexOf(searchKeyword) > -1)
                    {
                        // keyword found
                        searchResults.push({
                            item: key,
                            newVal: cacheNew[key]
                        });
                    }
                }
            });
        }

        if(options.printSearchResultsToConsoleAsWell)
        {
            console.log('statemon search results:', searchResults);
        }
        if(searchResults.length === 0)
        {
            searchResults.push({
                item: 'No results!',
                newVal: null
            });
        }

        // trim the array
        while (searchResults.length > options.searchResultsLimit) {
            searchResults.pop();
        }

        setTimeout(() =>
        {
            searchActive = false;
            toggleSearchLoading();
            logArrayItems(searchResults, 'search');
        }, 200);
    }
}
/* Find access to the state or raise error flag: */
function findStatefulDivs() {
    let arr = [...document.body.children].filter((element) =>
    {
        return element?.__vue__?.$store?.state !== undefined;
    });

    if(arr.length === 0)
    {
        togglers.hasErrors = true;
        let arr2 = [...document.body.children].filter((element) =>
        {
            return element?.__vue__ !== undefined;
        });
        if(arr2.length > 0)
        {
            console.log('Statemon: Vue detected but without access to the state! Vue divs:', arr2);
        }
    }

    return arr;
}
/* Remove if not using as a Chrome snippet */ function helloWorld() {
    /* Prints to the console when run as a Chrome snippet */
    let msg = togglers.hasErrors ? 'Errors were found' : 'Ready to start';
    return 'Statemon v' + statemon_version + ' **Monitor/search the Vue state** ' + msg + '...';
} helloWorld();
