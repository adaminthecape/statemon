/** Statemon v1.7 :: Monitor the Vue state on live sites and localhost **/
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
    // v1.5: (coming soon) todo: find the state without being given a div name
    // v1.6: added RAM overflow handling & better garbage collection.
    // v1.7: added search
};
/* Initialize variables: */
let options = {
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
    keysBase0: [
        // comment out whatever you don't want to monitor (greatly improves performance)
        "app", "statistics", "user", "profiles", "userLists",
        "admin", "dataSchemas", "entities", "powerUps",
        "applications", "entityDefinitions", "communications", "emailTemplates",
        "chats", "dataMappings", "handlebars"
    ],
    keysBase: [
        // all the top level keys you'd expect to find in the state (as of May 4 2021)
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
    hideAdded: true, // hide NEW items in the state (set to false if you like clutter)
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
    buttonOffsetTop = 0, // so the buttons aren't on top of each other
    toggler = null, // for toggling buttons
    browserLogTxt = '', // to output to the browser
    stateCache = {}, // getStateData() cache
    oldValTemp = null, // temp variable for comparisons
    newValTemp = null, // temp variable for comparisons
    searchCacheTryingAgain = false, // flag for search function
    ramBox = null; // ram usage indicator

function init() {
    // get app, store, state
    app = document.getElementById('app') || null;
    store = app?.__vue__.$store || null;
    state = store?.state || null;
    addTheStyles(); // make the buttons bearable
    addButtonContainer(); // does what it says
    createButton('snapshot', getSnapshot, 'snapshot');
    createButton('toggleMonitoring', toggleMonitoring, 'monitor');
    createButton('toggleChanges', toggleChangeBox, 'hide changes');
    createButton('toggleHideAdded', toggleHideAdded, 'show additions');
    createButton('status', null, 'status');
    createSearchBox();
    createChangeBox();
    document.addEventListener('keydown', hideChangesOnKey);
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
            #statemon-search-go {
                width: 10%;
            }
            .statemon-container {
                position: absolute;
                top: 120px;
                right: 20px;
            }
            .statemon-changebox {
                position: absolute;
                right: 20px;
                width: 440px;
                height: 500px;
                overflow-y: scroll;
                border: 1px solid green;
                opacity: 0.9;
                color: green;
                padding: 2px;
                display: flex;
                flex-direction: column;
                background: rgba(255,255,255);
                z-index: 1000000000;
            }
            .statemon-searchbox {
                position: absolute;
                right: 20px;
                width: 440px;
                height: 100px;
                overflow-y: scroll;
                border: 1px solid green;
                opacity: 0.9;
                color: green;
                padding: 2px;
                display: flex;
                flex-direction: column;
                background: rgba(255,255,255);
                z-index: 1000000000;
            }
            .statemon-changebox > div {
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
                position: absolute;
                right: 20px;
                padding: 8px;
                border: 1px solid green;
                border-radius: 20px;
                cursor: pointer;
                width: auto;
                height: 40px;
                background: 'rebeccapurple';
                z-index: 10000;
                text-align: center;
                line-height: 0px;
            }
            .statemon-button:hover {
                box-shadow: 0px 0px 0px 24px rgba(0,0,0,0.1);
                width: auto;
            }
        `;
        document.head.appendChild(style);
    }
}
function addButtonContainer() {
    var protoContainer = document.createElement('div');
    protoContainer.id = 'statemon-container';
    document.body.appendChild(protoContainer); // todo: make this scroll with the page
    container = document.getElementById('statemon-container');
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
        btn.style.top = 200 + buttonOffsetTop + 'px';
        btn.addEventListener("click", onclick);
        container.appendChild(btn);
        buttonOffsetTop += 50;
    }
}
function createChangeBox() {
    let id = 'statemon-changeBox';
    // remove existing buttons
    document.getElementById(id)?.remove();
    // create the button
    var box = document.createElement('div');
    if(box)
    {
        box.id = id;
        box.className += 'statemon-changebox';
        box.style.top = 200 + buttonOffsetTop + 'px';
        container?.appendChild(box);
        buttonOffsetTop += 500;
        changeBox = document.getElementById(id);
    }
}
function toggleChangeBox() {
    toggleBox(changeBox, 'statemon-button-toggleChanges', 'boxOpen', 'show changes', 'hide changes');
}
function toggleSearchBox() {
    toggleBox(searchBox, 'statemon-button-toggleChanges', 'boxOpen', 'show changes', 'hide changes');
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
function createSearchBox() {
    let id = 'statemon-searchbox';
    // remove existing buttons
    document.getElementById(id)?.remove();
    // create the button
    var btn = document.createElement('div');
    if(btn && container)
    {
        btn.id = id;
        btn.className += id;
        btn.style.top = 200 + buttonOffsetTop + 'px';
        container?.appendChild(btn);
        buttonOffsetTop += 100;
        searchBox = document.getElementById(id);

        searchBox.innerHTML += `
        <div id="statemon-search-input-container">
        <input type="text" placeholder="Search ..." name="statemon-search-input" id="statemon-search-input" />
        <button onClick="searchCache" id="statemon-search-go">Go</button>
        </div>
        `;
    }
}
/* On click listeners: */
function toggleMonitoring() {
    toggleSomething('statemon-button-toggleMonitoring', 'monitoring', monitor, 'stop monitoring', 'start monitoring');
}
function toggleHideAdded() {
    toggleSomething('statemon-button-toggleHideAdded', 'hideAdded', null, 'show additions', 'hide additions');
}
function toggleSomething(id, bool, callback, textStarted, textStopped) {
    toggler = document.getElementById(id);
    if(!togglers[bool])
    {
        // fire it up
        toggler.innerText = textStarted;
        togglers[bool] = true;
        if(callback) callback();
        return;
    }
    else
    {
        // kill it
        toggler.innerText = textStopped;
        togglers[bool] = false;
        return;
    }
}
/* Helpers: */
function isObjWithKeys(item) {
    return item && (typeof item === 'object') && Object.keys(item)?.length > 0;
}
function isReallyAnArray(item) {
    return item && Array.isArray(item) && item.length > 0; // don't judge me
}
function logArrayItems(arr, tag = '') {
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
        arr.forEach((x, i) => logItemToBrowser(x, i));
    }
}
function logItemToConsole(x, i) {
    if(x.status === 'added' && !togglers.hideAdded)
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
function logItemToBrowser(x, i) {
    if(changeBox)
    {
        if(x.status === 'added' && !togglers.hideAdded)
        {
            //console.log(tag + ' ' + i,x.item,options.added.message,x.newVal);
            browserLogTxt = `
            <div class='scb-added'>
                <div class='scb-item'>` + '[' + i + '] ' + x.item.replaceAll(',', '/') + `</div>
                <div class='scb-newVal'>` + x.newVal + `</div>
            </div>
            `;
            changeBox.innerHTML = browserLogTxt + changeBox.innerHTML;
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
            changeBox.innerHTML = browserLogTxt + changeBox.innerHTML;
        }
    }
}
/* The hard workers: */
function getStateData() {
    /* get the state and copy it to a new object */
    // clear the cache
    stateCache = {};
    // for each key:
    options.keysBase.forEach((key) =>
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
    let ramInterval = setInterval(() => {
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
        let interval = setInterval(() =>
        {
            // destroy on max count
            if(!togglers['monitoring'])
            {
                clearInterval(interval);
                console.log('Monitoring finished - toggled by user.');
            }
            if(shouldDieBecauseTooMuchRam())
            {
                clearInterval(interval);
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
    if(state)
    {
        console.log('snapshot::');
        console.log('cacheNew', cacheNew);
        console.log('cacheOld', cacheOld);
        console.log('stateCache', stateCache);
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
        let count = 0;
        while (
            changeBox.firstChild
            && (changeBox.children.length > 10)
            && count++ < 100
        ) {
            changeBox.removeChild(changeBox.lastChild);
        }
    }
}
function updateRamUsage() {
    /* output RAM usage to the ui */ 
    if(togglers.monitoring)
    {
        let ramBox = document.getElementById('statemon-button-status');
        let x = currentRamUsage();
        if(x > 500) shouldDieBecauseTooMuchRam();
        if(ramBox) ramBox.innerHTML = 'RAM: ' + x + ' MB';
    }
}
function currentRamUsage() {
    /* get current RAM usage */ 
    return Math.round(window.performance.memory.usedJSHeapSize / 1048536);
}
/* Search: */
function searchCache() {
    /* search the cache for a string */
    console.log('searching for:', keyword, cacheNew);

    // build a cache if none exists
    if(Object.keys(cacheNew)?.length === 0 && !togglers.monitoring)
    {
        monitorFn();
        searchCache;
    }

    // search
    if(keyword !== '' && Object.keys(cacheNew)?.length > 0)
    {
        // iterate over the object and find the keyword
        Object.keys(cacheNew).forEach((key) =>
        {
            if(cacheNew[key].toString().indexOf(keyword) > -1)
            {
                // keyword found
                console.log('found:', key, cacheNew[key]);
            }
        });
    }
}
