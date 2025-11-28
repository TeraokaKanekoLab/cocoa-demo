#include "Movie.h"

Movie::Movie() {
    fstream file;
    string file_path = "./data/index_to_title.txt";
    file.open(file_path, ios::in);
    assert(file.is_open());
    string str;
    string line;
    while (getline(file, line)) {
        stringstream ss{line};
        getline(ss, str, ' ');
        int movie_id = stoi(str);
        getline(ss, str, '\n');
        string title = str;
        // if (title[0] == '"') {
        //     title += ',';
        //     getline(ss, str, '"');
        //     title += str;
        //     title += '"';
        // }
        movie_id_to_title.emplace(movie_id, title);
    }
    file.close();

    string bipartite_attribute_file_path = "./data/bipartite-attributes.txt";
    file.open(bipartite_attribute_file_path, ios::in);
    assert(file.is_open());
    string attribute, val;
    bool error_flag = false;
    while (getline(file, line)) {
        stringstream ss{line};
        getline(ss, attribute, ' ');
        if (attribute == "type1") {
            getline(ss, val, ' ');
        } else if (attribute == "type2") {
            getline(ss, val, ' ');
        } else if (attribute == "type1_count") {
            getline(ss, val, ' ');
            movie_count = stoi(val);
        } else error_flag = true;
    }
    file.close();
    assert(!error_flag);

    // load pagerank
    // file_path = string(getenv("HOME")) + "/StandAloneGraph/eval/movie-recommendation/eval_pagerank.txt";
    // file.open(file_path, ios::in);
    // assert(file.is_open());
    // splitter = ' ';
    // while (getline(file, line)) {
    //     stringstream ss{line};
    //     getline(ss, str, splitter);
    //     double pr_val = stod(str);
    //     getline(ss, str, splitter);
    //     int movie_id = stoi(str);

    //     movie_id_to_pr.emplace(movie_id, pr_val);
    // }
    // file.close();

    // load degree centrality
    // file_path = string(getenv("HOME")) + "/StandAloneGraph/eval/movie-recommendation/create_degree-centrality.txt";
    // file.open(file_path, ios::in);
    // assert(file.is_open());
    // splitter = ' ';
    // while (getline(file, line)) {
    //     stringstream ss{line};
    //     getline(ss, str, splitter);
    //     int node_id = stod(str);
    //     getline(ss, str, splitter);
    //     double dc_val = stod(str);

    //     if (node_id <= 1000000) {
    //         movie_id_to_dc.emplace(node_id, dc_val);   
    //     }
    // }
    // file.close();

}

// return "" for invalid input
string Movie::get_movie_id_to_title(int movie_id) const {
    if (movie_id_to_title.count(movie_id) != 0) 
        return movie_id_to_title.at(movie_id);
    else
        return "";
}

void Movie::print_ranking(map<int, double>& ppr, int k) const {
    vector<pair<int, double>> ordered_ppr = get_ordered_map(ppr);
    int counter = 0;
    for (int i = 0; counter < k; i++) {
        pair<int, double> p = ordered_ppr.at(i);
        int node_id = p.first;
        double ppr_val = p.second;
        if (is_movie(node_id)) {
            counter++;
            string title = get_movie_id_to_title(node_id);
            assert(title != "");
            cout << counter << "\t" << setprecision(5) << ppr_val <<  "\t" <<  title << " ID : "<< node_id << "\t(#" << movie_id_to_dc_ranking.at(node_id) << ")" << endl;
        }
    }
    cout << endl << endl;
}

void Movie::print_ranking(unordered_map<int, double>& ppr, int k) const {
    map<int, double> ppr_map(ppr.begin(), ppr.end());
    print_ranking(ppr_map, k);
}

void Movie::set_ordered_dc(vector<pair<int, double>> input_ordered_dc) {
    ordered_dc = input_ordered_dc;
    int ranking = 1;
    for (pair<int, double> p : ordered_dc) {
        int node_id = p.first;
        if (is_movie(node_id)) {
            movie_id_to_dc_ranking.emplace(node_id, ranking++);
        }
    }
}

// vector<pair<int, double>> Movie::get_increase_movie_ranking(map<int, double> ppr, int k) {
//     vector<pair<int, double>> ordered_ppr = get_ordered_map(ppr);
//     vector<pair<int, double>> increase_ranking;
//     k = min(k, (int)ordered_ppr.size());
//     double min_increase_val = 1;
//     int max_rank = 1000;
//     int rank_suf;
//     for (rank_suf = 0; rank_suf < k; rank_suf++) {
//         int node_id = ordered_ppr.at(rank_suf).first;
//         double ppr_val = ordered_ppr.at(rank_suf).second;
//         if (node_id <= 1000000) {
//             double dc_val = movie_id_to_dc.at(node_id);
//             double increase_val = ppr_val - dc_val;
//             // cout << rank_suf << " " << node_id << " " << ppr_val << " " << dc_val << " " << increase_val << " " << min_increase_val << endl;
//             min_increase_val = min(min_increase_val, increase_val);
//             increase_ranking.push_back(make_pair(node_id, increase_val));
//         } //else cout << rank_suf << " " << node_id << " " << ppr_val << " " << min_increase_val << endl;
//     }
//     sort(increase_ranking.begin(), increase_ranking.end(),
//         [](const pair<int, double> &l, const pair<int, double> &r)
//         {
//             if (l.second != r.second) {
//                 return l.second > r.second;
//             }
//             return l.first < r.first;
//         });
//     increase_ranking.resize(k);
//     for (; rank_suf < min(max_rank, (int)ordered_ppr.size()); rank_suf++) {
//         int node_id = ordered_ppr.at(rank_suf).first;
//         double ppr_val = ordered_ppr.at(rank_suf).second;
//         if (ppr_val < min_increase_val) break;

//         if (node_id <= 1000000) {
//             double dc_val = movie_id_to_dc.at(node_id);
//             double increase_val = ppr_val - dc_val;
//             //cout << rank_suf << " " << node_id << " " << ppr_val << " " << dc_val << " " << increase_val << " " << min_increase_val << endl;
//             if (increase_val > min_increase_val) {
//                 // increase_ranking.push_back(make_pair(node_id, increase_val));
//                 for (int suf = increase_ranking.size()-1; suf > 0; suf--) {
//                     if (increase_ranking.at(suf-1).second < increase_val) {
//                         increase_ranking[suf] = increase_ranking.at(suf-1);
//                     } else {
//                         increase_ranking[suf] = make_pair(node_id, increase_val);
//                         break;
//                     }
//                 }
//                 min_increase_val = increase_ranking.back().second;
//             }
//         } //else cout << rank_suf << " " << node_id << " " << ppr_val << " " << min_increase_val << endl;
//     }

//     sort(increase_ranking.begin(), increase_ranking.end(),
//         [](const pair<int, double> &l, const pair<int, double> &r)
//         {
//             if (l.second != r.second) {
//                 return l.second > r.second;
//             }
//             return l.first < r.first;
//         });
//     increase_ranking.resize(k);
//     return increase_ranking;
// }

// void Movie::print_increase_ranking(vector<pair<int, double>> ppr, int k) {
//     // ppr.resize(k);
//     int counter = 0;
//     for (pair<int, double> p : ppr) {
//         int movie_id = p.first;
//         double ppr_val = p.second;
//         string title = get_movie_id_to_title(movie_id);
//         if (title == "") {
//             cout << "error: " << movie_id << " " << ppr_val << endl;
//         }
//         assert(title != "");
//         cout << ++counter << "\t" << setprecision(5) << ppr_val <<  "\t" <<  title << " (" << setprecision(8) << movie_id_to_dc.at(movie_id) << ")" <<  endl;
//         if (counter >= k) break;
//     }

//     cout << endl;
// }

// vector<int> Movie::get_all_movie_id_list() const {
//     vector<int> movie_id_list;
//     for (const auto [movie_id, _] : movie_id_to_title) {
//         movie_id_list.push_back(movie_id);
//     }
//     return movie_id_list;
// };