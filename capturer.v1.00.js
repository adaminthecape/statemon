let capturer = {
    app: document.getElementById('app'),
    options: {
    	consoleOnly: true
    },
    styles: null,
    elTemp: null,
    newstuff: null,
    container: null,
	searchKeyword: '',
	results: [],
	activeResult: null,

    say(msg)
    {
        console.log('** Script: **', msg);
    },
    init()
    {
    	document.getElementById('capturer-container')?.remove();

        capturer.say('hello');

        if(capturer.options.consoleOnly)
        {
        	capturer.say('Console only mode enabled in options. Usage:');
        	capturer.say('Enter "capturer.findByTag(tag)" in the console');
        	capturer.say('"tag" is the componentTag you want to find (or any part of it) - case insensitive');

            return;
        }

        // set buttonContainer
		capturer.container = capturer.freshElement('capturer-container', 'div');
		capturer.clickers = capturer.freshElement('capturer-clickers', 'div');
		capturer.activeContainer = capturer.freshElement('capturer-activeContainer', 'div');

		if(capturer.container)
		{
		    // add searchBox
		    capturer.createSearchBox();
            // fill buttonContainer
			capturer.container.appendChild(capturer.clickers);
			capturer.container.appendChild(capturer.activeContainer);

            // add to page
            document.body.appendChild(capturer.container);
            capturer.addTheStyles();

            capturer.container = document.getElementById('capturer-container');
            capturer.clickers = document.getElementById('capturer-clickers');
            capturer.activeContainer = document.getElementById('capturer-activeContainer');

            // add buttons
            capturer.createButton('start', capturer.findByTag, 'Find', 'capturer-search-input-container');
		}
    },
	createSearchBox()
	{
        if(capturer.options.consoleOnly) return;

		capturer.searchBox = capturer.freshElement('capturer-searchBox', 'div');

		if(capturer.searchBox && capturer.container)
		{
			capturer.container.appendChild(capturer.searchBox);
			capturer.searchBox.innerHTML += `
    <div id="capturer-search-input-container">
        <input type="text" placeholder="Search components..." id="capturer-search-input" value="${capturer.searchKeyword}" />
    </div>
            `;
		}
	},
	createButton(id, onclick, label, parent = 'capturer-clickers')
	{
        if(capturer.options.consoleOnly) return;

		capturer.elTemp = capturer.freshElement(`capturer-button-${id}`, 'button');

		if(capturer.elTemp && capturer.clickers)
		{
			capturer.elTemp.id = `capturer-button-${id}`;
			capturer.elTemp.innerText += label;
			capturer.elTemp.className += 'capturer-button';
			capturer.elTemp.addEventListener('click', onclick);
			document.getElementById(parent).appendChild(capturer.elTemp);
		}
	},
    freshElement(elId, type)
    {
        if(capturer.options.consoleOnly) return;

		document.getElementById(elId)?.remove();

        capturer.elTemp = document.createElement(type);
        capturer.elTemp.id = elId;

        return capturer.elTemp;
	},
	addTheStyles()
	{
        if(capturer.options.consoleOnly) return;

		capturer.styles = capturer.freshElement('capturer-style', 'style');

		if(capturer.styles)
		{
			capturer.styles.id = 'capturer-style';
			capturer.styles.innerHTML = `
                #capturer-container {
                    position: fixed;
                    top: 200px;
                    right: 10px;
                    min-width: 200px;
                    min-height: 200px;
                    width: 20%;
                    height: 50%;
                    z-index: 10000;
                    border: 1px solid black;
                    background: #aaa;
                }
                .__focused {
                    box-shadow: 0 0 50px 50px #222;
                }
                button {
                    cursor: pointer;
                }
            `;

			document.head.appendChild(capturer.styles);
		}
	},
	removeResultsButtons()
	{
        while(document.getElementById('capturer-clickers')?.children?.length)
        {
        	document.getElementById('capturer-clickers').children[0].remove();
        }
	},
    findByTag(tag = 'xxxxxxx')
    {
        // get the tag
        let keyword = null;

        if(capturer.options.consoleOnly)
        {
        	keyword = tag;
        }
        else
        {
        	keyword = document.getElementById('capturer-search-input')?.value?.toLowerCase();
        }

        // get the app
        const app = document.getElementById('app')?.__vue__;

        console.log('** findByTag: ** searching for tag:', { keyword });

        capturer.results = [];
        capturer.removeResultsButtons();

        const results = capturer.iterateChildren(app, keyword);

        const data = { results, elements: results.map((r) => (r.el)) };

        console.log('** findByTag: ** found', results.length, 'components:', data);

        capturer.results = results;

        if(capturer.options.consoleOnly)
        {
        	console.log('** findByTag: ** Specify a result by number with capturer.pick(#)');
        }
        else
        {
			data.elements.forEach((el, i) =>
			{
				capturer.createButton(`capturer-btn-${i}`, () => capturer.highlightElement(el, i), `${i}`);
			});
        }
    },
    dotPick(obj, desc)
    {
    	desc = desc.replaceAll("document.getElementById('app').", '');
    	desc = desc.replaceAll('[', '.');
    	desc = desc.replaceAll(']', '.');
    	desc = desc.replaceAll('..', '.');

        if(desc.substring(desc.length - 1, desc.length) === '.')
        {
        	desc = desc.substring(0, desc.length - 1);
        }

		var arr = desc.split(".");
		while(arr.length && (obj = obj[arr.shift()]));
		return obj;
	},
    pick(num = 0)
    {
    	const result = capturer.results[num];

        if(!result)
        {
        	capturer.say('No result found!');

            return;
        }

        const component = capturer.dotPick(document.getElementById('app').__vue__, result.path);
        const props = component.$options.propsData;
        const $options = component.$options;
        const data = component.$data;
        const attributes = {};
        const attributeKeys = Object.keys(component).filter((k) => {
        	return (
        	    k.substring(0, 1) !== '$' &&
        	    k.substring(0, 1) !== '_' &&
        	    typeof component[k] !== 'function'
        	);
        });
        attributeKeys.forEach((key) => {
            attributes[key] = component[key];
        });

        const resultData = { component, props, $options, attributes };

        return resultData;
    },
    highlightElement(el, i = -1)
    {
        if(capturer.options.consoleOnly) return;

        capturer.results.forEach((r) =>
        {
            r?.el?.classList?.remove('__focused');
        });

        el.focus();
        el.classList.add('__focused');

        if(i > -1)
        {
            capturer.activeResult = capturer.results[i];

            // set display data
            capturer.activeContainer.innerHTML = `
                <span>Props:<br /></span>
                <pre>none</pre>
            `;
        }
    },
    iterateChildren(parent, tag, depth = 0, parentPath = "document.getElementById('app')")
    {
        const results = [];

        parent.$children.forEach((child, i) =>
        {
            const path = `${parentPath}.$children[${i}]`;
            const componentTag = child?.$options?._componentTag?.toLowerCase();

            // check the componentTag
            if(componentTag?.indexOf(tag) > -1)
            {
                results.push({
                    path,
                    depth,
                    tag: componentTag,
                    el: child.$el
                });
            }

            // recurse
            if(child.$children?.length)
            {
                results.push(...capturer.iterateChildren(child, tag, depth + 1, path));
            }
        });

        return results;
    }
};

capturer.init();