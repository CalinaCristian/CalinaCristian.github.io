(async () => {
    document.getElementById('chapter').classList.add('hide');

    const BASE_PATH = '/public/chapters';
    const { titles } = await (await fetch(`${BASE_PATH}/info.json`)).json();

    const chapters = [];

    for (let title of titles) {
        const res = await fetch(`${BASE_PATH}/${Object.keys(title)[0]}.json`);
        const result = await res.json();
        
        chapters.push(result);
    }

    handleBack = () => {
        document.getElementById('nav').classList.remove('hide');
        document.getElementById('chapter').classList.add('hide');
    };

    titles.forEach(titleObj => {
        const label = Object.values(titleObj)[0];

        const childDiv = document.createElement("div");

        childDiv.onclick = function() {
            document.getElementById('nav').classList.add('hide');
            document.getElementById('chapter').classList.remove('hide');

            const index = titles.findIndex(t => Object.values(t)[0] === this.innerHTML);

            document.getElementById('title').innerText = chapters[index].title;
            document.getElementById('description').innerText = chapters[index].description;
            document.getElementById('content').innerText = chapters[index].content.join('\n');

            if (chapters[index].references && Object.keys(chapters[index].references).length > 0) {
                document.getElementById('references').classList.remove('hide');
                document.getElementById('references').innerHTML = 'REFERINTE';

                Object.keys(chapters[index].references).forEach(key => {
                    const div = document.createElement('div');
                    const link = document.createElement('a');

                    link.appendChild(document.createTextNode(key));
                    link.setAttribute("href", chapters[index].references[key]);
                    link.setAttribute("target", "_blank");
                    div.appendChild(link);
                    document.getElementById('references').appendChild(div);
                })
            } else {
                document.getElementById('references').classList.add('hide');
            }
        };

        childDiv.appendChild(document.createTextNode(label));
        document.getElementById('nav').appendChild(childDiv);
    });
})();